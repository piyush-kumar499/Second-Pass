import { env } from "../env";

export type Task = "generate" | "chat" | "ingest";

// Which env keys each task prefers, in order. Every task can use any key:
// the preferred ones come first, then the rest, so a single GROQ_API1 is
// enough to make generation, chat and ingest all work.
export const TASK_KEY_LABELS: Record<Task, string[]> = {
  generate: ["GROQ_API1", "GROQ_API3", "GROQ_API2", "GROQ_API4"],
  chat: ["GROQ_API2", "GROQ_API4", "GROQ_API1", "GROQ_API3"],
  ingest: ["GROQ_API3", "GROQ_API1", "GROQ_API2", "GROQ_API4"],
};

export const FALLBACK_KEY_LABEL = "GOOGLE_API1";

// Free-plan models, checked against the providers' docs on 2026-11-27.
// Groq free chat models: openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.8-27b.
// Gemini free defaults:   gemini-3.8-flash, gemini-4-hydrogen, gemini-3.6-flash.
// Override any of them with MODEL_GENERATE / MODEL_CHAT / MODEL_INGEST / MODEL_FALLBACK.
// Check https://console.groq.com/docs/models before changing them.
export function modelFor(task: Task): string {
  switch (task) {
    case "generate":
      return env("MODEL_GENERATE", "openai/gpt-oss-120b");
    case "chat":
      return env("MODEL_CHAT", "openai/gpt-oss-20b");
    case "ingest":
      return env("MODEL_INGEST", "openai/gpt-oss-120b");
  }
}

export function fallbackModel(): string {
  return env("MODEL_FALLBACK", "gemini-3.8-flash");
}

export const TASK_SETTINGS: Record<Task, { temperature: number; maxTokens: number }> = {
  generate: { temperature: 0.4, maxTokens: 8000 },
  chat: { temperature: 0.5, maxTokens: 900 },
  ingest: { temperature: 0.1, maxTokens: 4000 },
};
