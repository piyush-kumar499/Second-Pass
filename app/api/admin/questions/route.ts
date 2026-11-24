import { adminOrError } from "@/lib/admin-guard";
import { one, run, transaction } from "@/lib/db";
import { hashQuestion, looksGarbled } from "@/lib/questions";
import { commitQuestionsSchema } from "@/lib/schema/ingest";

export const dynamic = "force-dynamic";

// Save the admin-approved questions. Duplicates are skipped by hash.
export async function POST(request: Request) {
  const guard = await adminOrError();
  if ("response" in guard) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = commitQuestionsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Check the questions." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  let saved = 0;
  let skipped = 0;
  let flagged = 0;

  await transaction(async () => {
    let paper = await one<{ id: number }>(
      "SELECT id FROM papers WHERE subject_id = ? AND session = ?",
      [input.subjectId, input.session],
    );

    if (!paper) {
      const inserted = await run(
        `INSERT INTO papers (subject_id, session, year, source_note, source_url, fetched_at, verified)
         VALUES (?, ?, ?, ?, ?, datetime('now'), 0) RETURNING id`,
        [
          input.subjectId,
          input.session,
          input.year ?? null,
          input.sourceNote ?? "Added by admin",
          input.sourceUrl || null,
        ],
      );
      paper = { id: Number(inserted.rows[0]?.id) };
    }

    for (const question of input.questions) {
      const garbled = looksGarbled(question.text);
      const isFlagged = Boolean(question.flag) || garbled;
      const hash = hashQuestion(question.text);

      const result = await run(
        `INSERT INTO questions
           (subject_id, paper_id, unit_no, marks, text, year, session, hash, verified, flagged, flag_reason, source_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
         ON CONFLICT (subject_id, hash) DO NOTHING`,
        [
          input.subjectId,
          paper.id,
          question.unitNo ?? null,
          question.marks ?? null,
          question.text,
          question.year ?? input.year ?? null,
          input.session,
          hash,
          isFlagged ? 1 : 0,
          isFlagged
            ? garbled
              ? "Text looks garbled — fix it before publishing."
              : question.flagReason ?? "Flagged by admin"
            : null,
          input.sourceUrl || null,
        ],
      );

      if (result.rowsAffected > 0) {
        saved += 1;
        if (isFlagged) flagged += 1;
      } else {
        skipped += 1;
      }
    }
  });

  return Response.json({ ok: true, saved, skipped, flagged });
}
