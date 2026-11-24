import "./test-env";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { aiPageSchema, pageContentSchema, sectionSchema } from "../lib/schema/page";
import { extractJson, AiTaskError, runWithDeps, type Candidate } from "../lib/ai/run";
import { ProviderError } from "../lib/ai/client";
import { KeyPool } from "../lib/ai/keys";

const validSections = [
  {
    template: "cheat_sheet",
    title: "Key formulas",
    unit_no: 1,
    blocks: [{ type: "formula", latex: "a^2 + b^2 = c^2" }],
  },
];

describe("page schema", () => {
  it("accepts a valid AI page", () => {
    expect(aiPageSchema.safeParse({ sections: validSections }).success).toBe(true);
  });

  it("rejects an empty section list", () => {
    expect(aiPageSchema.safeParse({ sections: [] }).success).toBe(false);
  });

  it("rejects unknown block types such as images", () => {
    const result = sectionSchema.safeParse({
      template: "revision_sheet",
      title: "Unit 1",
      blocks: [{ type: "image", url: "https://example.com/x.png" }],
    });
    expect(result.success).toBe(false);
  });

  it("requires an answer for every question", () => {
    const result = sectionSchema.safeParse({
      template: "important_questions",
      title: "Questions",
      blocks: [{ type: "qa", question: "Explain X?", answer_blocks: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a full page with wrong meta", () => {
    const result = pageContentSchema.safeParse({
      meta: { subject_code: "S1", subject_name: "X", semester: 99, days_option: 3, version: "26-11", generated_at: "now" },
      sections: validSections,
    });
    expect(result.success).toBe(false);
  });
});

describe("extractJson", () => {
  it("pulls JSON out of markdown fences and chatter", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```\nDone')).toBe('{"a":1}');
  });

  it("handles plain JSON", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });
});

describe("AI retry and failover", () => {
  const schema = z.object({ ok: z.literal(true) });
  const candidate = (label: string): Candidate => ({
    provider: "groq",
    label,
    apiKey: "test",
    model: "test-model",
  });
  const messages = [{ role: "user" as const, content: "hello" }];

  it("retries once with the validation error, then succeeds", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ text: '{"ok":"wrong"}' })
      .mockResolvedValueOnce({ text: '{"ok":true}' });

    const result = await runWithDeps(
      { task: "generate", messages, schema, log: false },
      { candidates: [candidate("GROQ_API1")], call },
    );

    expect(call).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ ok: true });
    const retryMessages = call.mock.calls[1][1].messages;
    expect(retryMessages.at(-1).content).toContain("failed validation");
    expect(retryMessages.at(-1).content).toContain("ok");
  });

  it("gives up on a key after one bad retry and tries the next key", async () => {
    const call = vi
      .fn()
      .mockResolvedValue({ text: '{"ok":"still wrong"}' });

    await expect(
      runWithDeps(
        { task: "generate", messages, schema, log: false },
        { candidates: [candidate("GROQ_API1"), candidate("GROQ_API3")], call },
      ),
    ).rejects.toBeInstanceOf(AiTaskError);

    // 2 attempts on key 1 + 2 attempts on key 3.
    expect(call).toHaveBeenCalledTimes(4);
  });

  it("fails over immediately on a 429", async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(new ProviderError("rate limited", 429, 60_000))
      .mockResolvedValueOnce({ text: '{"ok":true}' });
    const markFailure = vi.fn();

    const result = await runWithDeps(
      { task: "chat", messages, log: false },
      { candidates: [candidate("GROQ_API1"), candidate("GROQ_API2")], call, markFailure },
    );

    expect(call).toHaveBeenCalledTimes(2);
    expect(markFailure).toHaveBeenCalledWith("GROQ_API1", 60_000);
    expect(result.keyLabel).toBe("GROQ_API2");
  });

  it("skips a key that is cooling down", () => {
    const pool = new KeyPool([
      { label: "GROQ_API1", value: "a" },
      { label: "GROQ_API2", value: "b" },
    ]);
    pool.markFailure("GROQ_API1", 60_000);
    const labels = pool.candidates(["GROQ_API1", "GROQ_API2"]).map((key) => key.label);
    expect(labels).toEqual(["GROQ_API2"]);
  });

  it("round-robins the starting key", () => {
    const pool = new KeyPool([
      { label: "GROQ_API1", value: "a" },
      { label: "GROQ_API3", value: "c" },
    ]);
    const first = pool.candidates(["GROQ_API1", "GROQ_API3"])[0].label;
    const second = pool.candidates(["GROQ_API1", "GROQ_API3"])[0].label;
    expect(new Set([first, second]).size).toBe(2);
  });
});
