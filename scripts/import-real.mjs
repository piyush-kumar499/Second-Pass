// Imports the real AKTU first-year data collected in data/real/aktu-first-year.json.
//
// Rules this script follows:
// - Every imported row has verified = 0. The owner approves it in /admin.
// - Re-runnable: subjects, units, papers and questions are matched before insert.
// - A row the owner already verified is never overwritten.
// - Question duplicates are skipped by the same hash the app uses.
//
// Usage: npm run db:import-real
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

async function loadEnv() {
  try {
    const text = await readFile(".env", "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // No .env: use the local default.
  }
}

function normaliseQuestion(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashQuestion(text) {
  return createHash("sha256").update(normaliseQuestion(text)).digest("hex").slice(0, 32);
}

function looksGarbled(text) {
  if (text.trim().length < 8) return true;
  const letters = (text.match(/[a-zA-Z]/g) ?? []).length;
  if (letters / text.length < 0.4) return true;
  return /[�]{1,}|[^\w\s,.;:()\-+/=%°'"?]{6,}/.test(text);
}

await loadEnv();

const url = process.env.TURSO_DATABASE_URL?.trim() || "file:./data/dev.db";

async function makeDriver() {
  if (url.startsWith("file:")) {
    const file = path.resolve(url.slice("file:".length));
    await mkdir(path.dirname(file), { recursive: true });
    const database = new DatabaseSync(file);
    database.exec("PRAGMA journal_mode = WAL");
    database.exec("PRAGMA foreign_keys = ON");
    return {
      kind: "local",
      execute(sql, args = []) {
        const statement = database.prepare(sql);
        const values = args.map((value) =>
          typeof value === "boolean" ? (value ? 1 : 0) : value === undefined ? null : value,
        );
        if (statement.columns().length > 0) return { rows: statement.all(...values), rowsAffected: 0 };
        const info = statement.run(...values);
        return { rows: [], rowsAffected: Number(info.changes) };
      },
    };
  }

  const { createClient } = await import("@libsql/client/web");
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined });
  return {
    kind: "turso",
    async execute(sql, args = []) {
      const result = await client.execute({ sql, args });
      return { rows: result.rows, rowsAffected: Number(result.rowsAffected ?? 0) };
    },
  };
}

const db = await makeDriver();
const data = JSON.parse(await readFile("data/real/aktu-first-year.json", "utf8"));
const fetchedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

const summary = [];

for (const subject of data.subjects) {
  const existingSubject = (
    await db.execute("SELECT id, verified FROM subjects WHERE code = ? AND scheme = ?", [
      subject.code,
      subject.scheme,
    ])
  ).rows[0];

  let subjectId;
  let subjectVerified;
  if (!existingSubject) {
    const inserted = await db.execute(
      `INSERT INTO subjects (code, name, semester, scheme, is_common, is_sample, verified, source_url, fetched_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?) RETURNING id`,
      [
        subject.code,
        subject.name,
        subject.semester,
        subject.scheme,
        subject.isCommon ? 1 : 0,
        subject.sourceUrl,
        fetchedAt,
      ],
    );
    subjectId = Number(inserted.rows[0].id);
    subjectVerified = 0;
  } else {
    subjectId = Number(existingSubject.id);
    subjectVerified = Number(existingSubject.verified);
    if (subjectVerified === 0) {
      await db.execute(
        `UPDATE subjects
         SET name = ?, semester = ?, is_common = ?, is_sample = 0, source_url = ?, fetched_at = ?
         WHERE id = ? AND verified = 0`,
        [
          subject.name,
          subject.semester,
          subject.isCommon ? 1 : 0,
          subject.sourceUrl,
          fetchedAt,
          subjectId,
        ],
      );
    }
  }

  for (const shortCode of subject.branches ?? []) {
    const branch = (
      await db.execute("SELECT id FROM branches WHERE short_code = ?", [shortCode])
    ).rows[0];
    if (branch) {
      await db.execute(
        "INSERT OR IGNORE INTO subject_branches (subject_id, branch_id) VALUES (?, ?)",
        [subjectId, Number(branch.id)],
      );
    }
  }

  for (const unit of subject.units) {
    const existingUnit = (
      await db.execute("SELECT id, verified FROM syllabus_units WHERE subject_id = ? AND unit_no = ?", [
        subjectId,
        unit.unitNo,
      ])
    ).rows[0];

    if (!existingUnit) {
      await db.execute(
        `INSERT INTO syllabus_units (subject_id, unit_no, title, topics_json, verified, source_url, fetched_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
        [
          subjectId,
          unit.unitNo,
          unit.title,
          JSON.stringify(unit.topics),
          subject.sourceUrl,
          fetchedAt,
        ],
      );
    } else if (Number(existingUnit.verified) === 0) {
      await db.execute(
        `UPDATE syllabus_units
         SET title = ?, topics_json = ?, source_url = ?, fetched_at = ?
         WHERE id = ? AND verified = 0`,
        [unit.title, JSON.stringify(unit.topics), subject.sourceUrl, fetchedAt, Number(existingUnit.id)],
      );
    }
  }

  summary.push({ code: subject.code, name: subject.name, subjectId, subjectVerified });
}

let savedQuestions = 0;
let skippedQuestions = 0;
let flaggedQuestions = 0;

for (const paper of data.papers) {
  const subject = summary.find((entry) => entry.code === paper.subjectCode);
  if (!subject) {
    console.warn(`! Paper skipped: subject ${paper.subjectCode} was not imported.`);
    continue;
  }

  let paperRow = (
    await db.execute("SELECT id FROM papers WHERE subject_id = ? AND session = ?", [
      subject.subjectId,
      paper.session,
    ])
  ).rows[0];

  if (!paperRow) {
    const inserted = await db.execute(
      `INSERT INTO papers (subject_id, session, year, source_note, source_url, fetched_at, verified)
       VALUES (?, ?, ?, ?, ?, ?, 0) RETURNING id`,
      [
        subject.subjectId,
        paper.session,
        paper.year ?? null,
        paper.sourceNote ?? null,
        paper.sourceUrl ?? null,
        fetchedAt,
      ],
    );
    paperRow = inserted.rows[0];
  }

  const paperId = Number(paperRow.id);
  for (const question of paper.questions) {
    const garbled = looksGarbled(question.text);
    // A star pattern is a legitimate run of symbols, so the data file can vouch for it.
    const flagged = question.forceClean ? false : Boolean(question.flag) || garbled;
    const reason = flagged
      ? garbled
        ? "Text looks garbled — fix it before publishing."
        : question.flagReason ?? "Flagged during import."
      : null;

    const result = await db.execute(
      `INSERT INTO questions
         (subject_id, paper_id, unit_no, marks, text, year, session, hash, verified, flagged, flag_reason, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
       ON CONFLICT (subject_id, hash) DO NOTHING`,
      [
        subject.subjectId,
        paperId,
        question.unitNo ?? null,
        question.marks ?? null,
        question.text,
        paper.year ?? null,
        paper.session,
        hashQuestion(question.text),
        flagged ? 1 : 0,
        reason,
        paper.sourceUrl ?? null,
      ],
    );

    if (result.rowsAffected > 0) {
      savedQuestions += 1;
      if (flagged) flaggedQuestions += 1;
    } else {
      skippedQuestions += 1;
    }
  }
}

// Small read-back so the output matches what /data/REPORT.md says.
for (const subject of summary) {
  const counts = (
    await db.execute(
      `SELECT
         (SELECT COUNT(*) FROM syllabus_units WHERE subject_id = ?) AS units,
         (SELECT COUNT(*) FROM papers WHERE subject_id = ?) AS papers,
         (SELECT COUNT(*) FROM questions WHERE subject_id = ?) AS questions,
         (SELECT COUNT(*) FROM questions WHERE subject_id = ? AND flagged = 1) AS flagged`,
      [subject.subjectId, subject.subjectId, subject.subjectId, subject.subjectId],
    )
  ).rows[0];
  console.log(
    `${subject.code} ${subject.name}: units=${counts.units}, papers=${counts.papers}, questions=${counts.questions}, flagged=${counts.flagged}`,
  );
}

console.log(
  `Questions inserted this run: ${savedQuestions}, duplicates skipped: ${skippedQuestions}, flagged: ${flaggedQuestions}.`,
);
console.log("Every imported row has verified = 0. Review it in /admin before publishing.");
console.log(
  db.kind === "local"
    ? `Database: ${path.resolve(url.slice("file:".length))}`
    : "Database: Turso (remote)",
);
