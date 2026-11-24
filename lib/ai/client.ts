import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CallInput = {
  model: string;
  messages: ChatMessage[];
  json: boolean;
  temperature: number;
  maxTokens: number;
};

export type CallOutput = {
  text: string;
  tokensIn?: number;
  tokensOut?: number;
};

export class ProviderError extends Error {
  status?: number;
  retryAfterMs?: number;
  constructor(message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

// Groq keys look like gsk_... and use the OpenAI-compatible chat API.
export async function callGroq(apiKey: string, input: CallInput): Promise<CallOutput> {
  const client = new Groq({ apiKey, timeout: 120_000, maxRetries: 0 });
  try {
    const completion = await client.chat.completions.create({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      ...(input.json ? { response_format: { type: "json_object" as const } } : {}),
    });
    return {
      text: completion.choices[0]?.message?.content ?? "",
      tokensIn: completion.usage?.prompt_tokens,
      tokensOut: completion.usage?.completion_tokens,
    };
  } catch (error) {
    const status = statusOf(error);
    const retryAfter =
      status === 429 ? 60_000 : status && status >= 500 ? 30_000 : status === 401 ? 3_600_000 : 15_000;
    throw new ProviderError(
      error instanceof Error ? error.message : "Groq request failed",
      status,
      retryAfter,
    );
  }
}

// Gemini is the fallback provider for every task.
export async function callGemini(apiKey: string, input: CallInput): Promise<CallOutput> {
  const ai = new GoogleGenAI({ apiKey });
  const systemInstruction = input.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const contents = input.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  try {
    const response = await ai.models.generateContent({
      model: input.model,
      contents,
      config: {
        systemInstruction: systemInstruction || undefined,
        temperature: input.temperature,
        maxOutputTokens: input.maxTokens,
        responseMimeType: input.json ? "application/json" : "text/plain",
      },
    });
    return {
      text: response.text ?? "",
      tokensIn: response.usageMetadata?.promptTokenCount,
      tokensOut: response.usageMetadata?.candidatesTokenCount,
    };
  } catch (error) {
    const status = statusOf(error);
    const retryAfter = status === 429 ? 60_000 : 30_000;
    throw new ProviderError(
      error instanceof Error ? error.message : "Gemini request failed",
      status,
      retryAfter,
    );
  }
}
