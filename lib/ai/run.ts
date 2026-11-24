import { z } from "zod";
import { run } from "../db";
import {
  FALLBACK_KEY_LABEL,
  TASK_KEY_LABELS,
  TASK_SETTINGS,
  fallbackModel,
  modelFor,
  type Task,
} from "./config";
import { callGemini, callGroq, ProviderError, type CallInput, type ChatMessage } from "./client";
import { getGoogleKey, getGroqPool } from "./keys";

export class NoKeysError extends Error {
  code = "NO_KEYS";
  constructor() {
    super("No AI keys are configured. Add GROQ_API1 or GOOGLE_API1 to .env.");
  }
}

export class AiTaskError extends Error {
  code = "AI_FAILED";
}

export type Candidate = {
  provider: "groq" | "google";
  label: string;
  apiKey: string;
  model: string;
};

export function candidatesFor(task: Task, fallbackModelName = fallbackModel()): Candidate[] {
  const pool = getGroqPool();
  const groq = pool.candidates(TASK_KEY_LABELS[task]).map((key) => ({
    provider: "groq" as const,
    label: key.label,
    apiKey: key.value,
    model: modelFor(task),
  }));
  const googleKey = getGoogleKey();
  const google = googleKey
    ? [
        {
          provider: "google" as const,
          label: FALLBACK_KEY_LABEL,
          apiKey: googleKey,
          model: fallbackModelName,
        },
      ]
    : [];
  return [...groq, ...google];
}

async function logCall(entry: {
  task: string;
  model: string;
  keyLabel: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}): Promise<void> {
  try {
    await run(
      `INSERT INTO ai_calls (task, model, key_label, tokens_in, tokens_out, latency_ms, success, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.task,
        entry.model,
        entry.keyLabel,
        entry.tokensIn ?? null,
        entry.tokensOut ?? null,
        entry.latencyMs,
        entry.success ? 1 : 0,
        entry.error ? entry.error.slice(0, 500) : null,
      ],
    );
  } catch {
    // Logging must never break a user request.
  }
}

// Model output is often wrapped in ```json fences or has text around the object.
export function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return body;
  return body.slice(start, end + 1);
}

export type RunResult<T> = {
  data: T | null;
  text: string;
  model: string;
  keyLabel: string;
  provider: "groq" | "google";
};

type RunOptions<T> = {
  task: Task;
  messages: ChatMessage[];
  schema?: z.ZodType<T>;
  json?: boolean;
  log?: boolean;
};

export type RunnerDeps = {
  candidates: Candidate[];
  call: (candidate: Candidate, input: CallInput) => Promise<{ text: string; tokensIn?: number; tokensOut?: number }>;
  log?: (entry: {
    task: string;
    model: string;
    keyLabel: string;
    tokensIn?: number;
    tokensOut?: number;
    latencyMs: number;
    success: boolean;
    error?: string;
  }) => Promise<void>;
  markFailure?: (label: string, retryAfterMs?: number) => void;
  markSuccess?: (label: string) => void;
};

// The retry/failover loop, with the outside world injected so it can be tested.
export async function runWithDeps<T>(options: RunOptions<T>, deps: RunnerDeps): Promise<RunResult<T>> {
  const { task, messages, schema } = options;
  const wantJson = options.json ?? Boolean(schema);
  const settings = TASK_SETTINGS[task];
  const { candidates } = deps;

  let lastError: unknown;

  for (const candidate of candidates) {
    let attemptMessages = messages;

    // Two attempts per key: the second one carries the validation error back to the model.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const input: CallInput = {
        model: candidate.model,
        messages: attemptMessages,
        json: wantJson,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      };
      const started = Date.now();

      try {
        const output = await deps.call(candidate, input);

        if (deps.log && options.log !== false) {
          await deps.log({
            task,
            model: candidate.model,
            keyLabel: candidate.label,
            tokensIn: output.tokensIn,
            tokensOut: output.tokensOut,
            latencyMs: Date.now() - started,
            success: true,
          });
        }
        deps.markSuccess?.(candidate.label);

        if (!schema) {
          return {
            data: null,
            text: output.text,
            model: candidate.model,
            keyLabel: candidate.label,
            provider: candidate.provider,
          };
        }

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(extractJson(output.text));
        } catch {
          throw new AiTaskError("The AI did not return valid JSON.");
        }

        const parsed = schema.safeParse(parsedJson);
        if (parsed.success) {
          return {
            data: parsed.data,
            text: output.text,
            model: candidate.model,
            keyLabel: candidate.label,
            provider: candidate.provider,
          };
        }

        const issues = parsed.error.issues
          .slice(0, 10)
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ");
        attemptMessages = [
          ...messages,
          { role: "assistant", content: output.text.slice(0, 4000) },
          {
            role: "user",
            content: `That JSON failed validation: ${issues}. Return the complete corrected JSON only, with no commentary.`,
          },
        ];
        lastError = new AiTaskError(`Invalid JSON: ${issues}`);
      } catch (error) {
        lastError = error;
        if (deps.log && options.log !== false) {
          await deps.log({
            task,
            model: candidate.model,
            keyLabel: candidate.label,
            latencyMs: Date.now() - started,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        if (error instanceof ProviderError) {
          deps.markFailure?.(candidate.label, error.retryAfterMs);
        }
        // Provider errors (429, 5xx, network): go straight to the next key.
        break;
      }
    }
  }

  // Every key and provider failed. Give a clear message, keep the technical detail in the log.
  const reason =
    lastError instanceof Error ? lastError.message : "The AI service is unavailable right now.";
  throw new AiTaskError(
    `Could not generate a valid answer after trying every key. ${reason.slice(0, 200)}`,
  );
}

// Calls the AI with key failover. With a schema, retries the same key once with the
// validation error, then moves to the next key/provider.
export async function runTask<T>(options: RunOptions<T>): Promise<RunResult<T>> {
  const { task } = options;
  const candidates = candidatesFor(task);
  if (candidates.length === 0) throw new NoKeysError();

  return runWithDeps(options, {
    candidates,
    call: (candidate, input) =>
      candidate.provider === "groq" ? callGroq(candidate.apiKey, input) : callGemini(candidate.apiKey, input),
    log: logCall,
    markFailure: (label, retryAfterMs) => getGroqPool().markFailure(label, retryAfterMs),
    markSuccess: (label) => getGroqPool().markSuccess(label),
  });
}
