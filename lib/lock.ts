import { one, run } from "./db";

const LOCK_TTL_SECONDS = 180; // 3 minutes, as required.

export type LockResult = { acquired: boolean; owner: string | null; expiresAt: string | null };

// Returns true when this user now owns the lock for this cache key.
export async function acquireLock(
  key: string,
  owner: string,
  now = new Date(),
): Promise<LockResult> {
  const nowMs = now.getTime();
  const staleBefore = new Date(nowMs - LOCK_TTL_SECONDS * 1000).toISOString();

  // Drop expired locks, then try to take it. INSERT OR IGNORE never overwrites a live lock.
  await run("DELETE FROM generation_locks WHERE key = ? AND locked_at < ?", [key, staleBefore]);

  const inserted = await run(
    "INSERT OR IGNORE INTO generation_locks (key, owner, locked_at) VALUES (?, ?, ?)",
    [key, owner, now.toISOString()],
  );

  const row = await one<{ owner: string; locked_at: string }>(
    "SELECT owner, locked_at FROM generation_locks WHERE key = ?",
    [key],
  );

  if (inserted.rowsAffected > 0) {
    return { acquired: true, owner, expiresAt: expiresAt(row?.locked_at ?? now.toISOString()) };
  }
  return {
    acquired: false,
    owner: row?.owner ?? null,
    expiresAt: row?.locked_at ? expiresAt(row.locked_at) : null,
  };
}

function expiresAt(lockedAt: string): string {
  return new Date(new Date(lockedAt).getTime() + LOCK_TTL_SECONDS * 1000).toISOString();
}

// Only the owner can release the lock.
export async function releaseLock(key: string, owner: string): Promise<void> {
  await run("DELETE FROM generation_locks WHERE key = ? AND owner = ?", [key, owner]);
}

export async function lockInfo(key: string) {
  return one<{ key: string; owner: string; locked_at: string }>(
    "SELECT key, owner, locked_at FROM generation_locks WHERE key = ?",
    [key],
  );
}

export const LOCK_TTL_MS = LOCK_TTL_SECONDS * 1000;
