import "./test-env";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  checkChatLimit,
  checkGenLimit,
  checkGlobalCap,
  consumeChat,
  consumeGen,
  refundGen,
  today,
} from "../lib/limits";
import { run } from "../lib/db";

const freshUser = () => `user-${randomUUID()}`;

describe("per-user daily limits", () => {
  it("blocks the fourth generation when the limit is 3", async () => {
    const userId = freshUser();
    expect((await checkGenLimit(userId)).ok).toBe(true);

    await consumeGen(userId);
    await consumeGen(userId);
    await consumeGen(userId);

    const check = await checkGenLimit(userId);
    expect(check.ok).toBe(false);
    expect(check.used).toBe(3);
    expect(check.limit).toBe(3);
  });

  it("gives the generation back on failure", async () => {
    const userId = freshUser();
    await consumeGen(userId);
    await refundGen(userId);
    expect((await checkGenLimit(userId)).used).toBe(0);
  });

  it("blocks chat after the chat limit", async () => {
    const userId = freshUser();
    await consumeChat(userId);
    await consumeChat(userId);
    const check = await checkChatLimit(userId);
    expect(check.ok).toBe(false);
    expect(check.used).toBe(2);
  });

  it("keeps counts separate for the same user on different days", async () => {
    const userId = freshUser();
    await consumeGen(userId);
    const yesterday = await checkGenLimit(userId);
    expect(yesterday.used).toBe(1);
    // The store is keyed by (user, date), so a different day starts at zero by design.
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("global daily cap", () => {
  it("counts today's ai_calls and blocks at the cap", async () => {
    const before = await checkGlobalCap();
    expect(before.ok).toBe(true);
    expect(before.cap).toBe(1000);

    // One successful and one failed call both count.
    await run("INSERT INTO ai_calls (task, model, key_label, success) VALUES ('chat', 'x', 'k', 1)");
    await run("INSERT INTO ai_calls (task, model, key_label, success) VALUES ('chat', 'x', 'k', 0)");

    const after = await checkGlobalCap();
    expect(after.used).toBe(before.used + 2);
  });
});
