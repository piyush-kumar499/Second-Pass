import { all, one, run } from "./db";
import { chatLimitPerUser, genLimitPerUser, globalDailyCap } from "./env";

export function today(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export type Usage = { gen_count: number; chat_count: number };

export async function getUsage(userId: string): Promise<Usage> {
  const row = await one<Usage>(
    "SELECT gen_count, chat_count FROM usage_daily WHERE user_id = ? AND date = ?",
    [userId, today()],
  );
  return { gen_count: row?.gen_count ?? 0, chat_count: row?.chat_count ?? 0 };
}

export type LimitCheck = { ok: boolean; used: number; limit: number; message?: string };

export async function checkGenLimit(userId: string): Promise<LimitCheck> {
  const usage = await getUsage(userId);
  const limit = genLimitPerUser();
  return {
    ok: usage.gen_count < limit,
    used: usage.gen_count,
    limit,
    message: `You have used ${usage.gen_count} of ${limit} page generations today. Try again tomorrow.`,
  };
}

export async function checkChatLimit(userId: string): Promise<LimitCheck> {
  const usage = await getUsage(userId);
  const limit = chatLimitPerUser();
  return {
    ok: usage.chat_count < limit,
    used: usage.chat_count,
    limit,
    message: `You have sent ${usage.chat_count} of ${limit} chat messages today. Try again tomorrow.`,
  };
}

export async function consumeGen(userId: string): Promise<void> {
  await run(
    `INSERT INTO usage_daily (user_id, date, gen_count, chat_count) VALUES (?, ?, 1, 0)
     ON CONFLICT (user_id, date) DO UPDATE SET gen_count = gen_count + 1`,
    [userId, today()],
  );
}

// Give the daily generation back when the AI call failed.
export async function refundGen(userId: string): Promise<void> {
  await run(
    `UPDATE usage_daily SET gen_count = MAX(gen_count - 1, 0) WHERE user_id = ? AND date = ?`,
    [userId, today()],
  );
}

export async function consumeChat(userId: string): Promise<void> {
  await run(
    `INSERT INTO usage_daily (user_id, date, gen_count, chat_count) VALUES (?, ?, 0, 1)
     ON CONFLICT (user_id, date) DO UPDATE SET chat_count = chat_count + 1`,
    [userId, today()],
  );
}

// Counts every AI call made today (UTC). Saved pages never depend on this.
export async function aiCallsToday(): Promise<number> {
  const row = await one<{ c: number }>(
    "SELECT COUNT(*) AS c FROM ai_calls WHERE created_at >= datetime('now', 'start of day')",
  );
  return row?.c ?? 0;
}

export type CapCheck = { ok: boolean; used: number; cap: number; message?: string };

export async function checkGlobalCap(): Promise<CapCheck> {
  const used = await aiCallsToday();
  const cap = globalDailyCap();
  return {
    ok: used < cap,
    used,
    cap,
    message:
      "The AI has reached its free daily limit. Saved pages still work — new generation and chat will be back tomorrow.",
  };
}

// Admin dashboard numbers.
export async function usageSummary() {
  const rows = await all<{ date: string; gens: number; chats: number }>(
    `SELECT date, SUM(gen_count) AS gens, SUM(chat_count) AS chats
     FROM usage_daily GROUP BY date ORDER BY date DESC LIMIT 14`,
  );
  const calls = await all<{ task: string; n: number; ok: number }>(
    `SELECT task, COUNT(*) AS n, SUM(success) AS ok
     FROM ai_calls WHERE created_at >= datetime('now', '-7 days') GROUP BY task`,
  );
  return { usage: rows, calls };
}
