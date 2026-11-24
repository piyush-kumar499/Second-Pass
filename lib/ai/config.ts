import { env } from "../env";

export type Task = "generate" | "chat" | "ingest";

// Which env keys each task uses, in order. Edit this freely.
// Any task falls back to GOOGLE_API1 if all its Groq keys fail.
export const TASK_KEY_LABELS: Record<Task, string[]> = {
  generate: ["GROQ_API1", "GROQ_API3"],
  chat: ["GROQ_API2", "GROQ_API4"],
  ingest: ["GROQ_API3"],
};

export const FALLBACK_KEY_LABEL = "GOOGLE_API1";

// Sensible defaults. Override with MODEL_GENERATE / MODEL_CHAT / MODEL_INGEST / MODEL_FALLBACK.
// Check https://console.groq.com/docs/models before changing them.
export function modelFor(task: Task): string {
  switch (task) {
    case "generate":
      return env("MODEL_GENERATE", "llama-3.3-70b-versatile");
    case "chat":
      return env("MODEL_CHAT", "llama-3.1-8b-instant");
    case "ingest":
      return env("MODEL_INGEST", "llama-3.3-70b-versatile");
  }
}

export function fallbackModel(): string {
  return env("MODEL_FALLBACK", "gemini-2.5-flash");
}

export const TASK_SETTINGS: Record<Task, { temperature: number; maxTokens: number }> = {
  generate: { temperature: 0.4, maxTokens: 8000 },
  chat: { temperature: 0.5, maxTokens: 900 },
  ingest: { temperature: 0.1, maxTokens: 4000 },
};
