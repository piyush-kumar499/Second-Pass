import "./test-env";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { generatePage } from "../lib/generate";
import { findPage } from "../lib/pages";
import { run } from "../lib/db";

async function createSubject(code: string) {
  const summary = await run(
    `INSERT INTO subjects (code, name, semester, scheme, is_common, is_sample, verified)
     VALUES (?, 'Test Subject', 3, '2026-27', 0, 1, 0) RETURNING id`,
    [code],
  );
  const subjectId = Number(summary.rows[0].id);
  await run(
    `INSERT INTO syllabus_units (subject_id, unit_no, title, topics_json, verified)
     VALUES (?, 1, 'Unit One', '["topic a","topic b"]', 0)`,
    [subjectId],
  );
  await run(
    `INSERT INTO questions (subject_id, unit_no, marks, text, year, session, hash, verified, flagged)
     VALUES (?, 1, 5, 'Explain test topic one with an example.', 2024, '2024-25 Odd', ?, 0, 0)`,
    [subjectId, `hash-${randomUUID()}`],
  );
  return subjectId;
}

describe("generate flow", () => {
  it("creates the page without AI keys, then serves it from cache", async () => {
    const subjectId = await createSubject(`SAMPLE9${Math.floor(Math.random() * 90 + 10)}`);
    const userId = `user-${randomUUID()}`;

    const first = await generatePage({ subjectId, daysOption: 2, userId });
    expect(first.status).toBe("created");

    const second = await generatePage({ subjectId, daysOption: 2, userId, note: "different note" });
    expect(second.status).toBe("existing");
    if (second.status === "existing" && first.status === "created") {
      expect(second.pageId).toBe(first.pageId);
    }
  });

  it("only lets one of two simultaneous requests write a page", async () => {
    const subjectId = await createSubject(`SAMPLE9${Math.floor(Math.random() * 90 + 10)}`);

    const [a, b] = await Promise.all([
      generatePage({ subjectId, daysOption: 5, userId: `user-${randomUUID()}` }),
      generatePage({ subjectId, daysOption: 5, userId: `user-${randomUUID()}` }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses.filter((status) => status === "created")).toHaveLength(1);
    expect(["existing", "locked"]).toContain(statuses.find((status) => status !== "created"));

    const page = await findPage(subjectId, 5);
    expect(page).not.toBeNull();
  });

  it("uses the syllabus-only mock and never invents questions", async () => {
    const subjectId = await createSubject(`SAMPLE9${Math.floor(Math.random() * 90 + 10)}`);
    // Delete all questions for this subject to check the "no papers" rule.
    await run("DELETE FROM questions WHERE subject_id = ?", [subjectId]);

    const outcome = await generatePage({ subjectId, daysOption: 1, userId: `user-${randomUUID()}` });
    expect(outcome.status).toBe("created");
    if (outcome.status !== "created") return;

    const page = await findPage(subjectId, 1);
    const content = JSON.parse(page!.content_json) as {
      sections: Array<{ template: string; blocks: Array<{ type: string; text?: string }> }>;
    };
    const important = content.sections.find((section) => section.template === "important_questions");
    expect(important).toBeDefined();
    expect(important!.blocks[0]).toMatchObject({ type: "note", text: "No verified past papers yet." });
  });
});
