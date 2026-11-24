import "./test-env";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { acquireLock, releaseLock, LOCK_TTL_MS } from "../lib/lock";
import { run, one } from "../lib/db";

const freshKey = () => `test:${randomUUID()}`;

describe("generation lock", () => {
  it("lets exactly one of two simultaneous requests generate", async () => {
    const key = freshKey();
    const [first, second] = await Promise.all([
      acquireLock(key, "user-a"),
      acquireLock(key, "user-b"),
    ]);

    const winners = [first, second].filter((result) => result.acquired);
    expect(winners).toHaveLength(1);
    expect(first.acquired ? first.owner : second.owner).toMatch(/user-[ab]/);
  });

  it("only the owner can release the lock", async () => {
    const key = freshKey();
    await acquireLock(key, "owner");
    await releaseLock(key, "someone-else");

    const stillThere = await one("SELECT owner FROM generation_locks WHERE key = ?", [key]);
    expect(stillThere?.owner).toBe("owner");

    await releaseLock(key, "owner");
    expect(await one("SELECT owner FROM generation_locks WHERE key = ?", [key])).toBeNull();
  });

  it("takes over an expired lock", async () => {
    const key = freshKey();
    const longAgo = new Date(Date.now() - LOCK_TTL_MS - 5_000);
    await run("INSERT INTO generation_locks (key, owner, locked_at) VALUES (?, ?, ?)", [
      key,
      "stale",
      longAgo.toISOString(),
    ]);

    const result = await acquireLock(key, "fresh");
    expect(result.acquired).toBe(true);
    expect(result.owner).toBe("fresh");
  });

  it("refuses while a live lock exists", async () => {
    const key = freshKey();
    const first = await acquireLock(key, "first");
    const second = await acquireLock(key, "second");
    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
    expect(second.owner).toBe("first");
  });
});
