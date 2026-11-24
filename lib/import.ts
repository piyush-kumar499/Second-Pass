import { z } from "zod";
import { all, one, run, transaction } from "./db";
import { parseCsv } from "./csv";

// CSV formats are documented in README.md and shown in the admin UI.
const subjectRowSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(150),
  semester: z.coerce.number().int().min(1).max(8),
  scheme: z.string().trim().min(4).max(20),
  is_common: z.coerce.number().int().min(0).max(1).optional().default(0),
  branches: z.string().trim().min(1),
  source_url: z.string().trim().url().optional().or(z.literal("")),
});

const unitRowSchema = z.object({
  code: z.string().trim().min(2).max(20),
  scheme: z.string().trim().max(20).optional().default(""),
  unit_no: z.coerce.number().int().min(1).max(10),
  title: z.string().trim().min(2).max(200),
  topics: z.string().trim().min(1),
  source_url: z.string().trim().url().optional().or(z.literal("")),
});

export type SubjectImportRow = {
  row: number;
  code: string;
  name: string;
  semester: number;
  scheme: string;
  isCommon: number;
  branchCodes: string[];
  sourceUrl: string;
};

export type UnitImportRow = {
  row: number;
  code: string;
  scheme: string;
  unitNo: number;
  title: string;
  topics: string[];
  sourceUrl: string;
};

export type ParseResult<T> = { rows: T[]; errors: string[] };

export function parseSubjectCsv(text: string): ParseResult<SubjectImportRow> {
  const { headers, rows } = parseCsv(text);
  const errors: string[] = [];
  const required = ["code", "name", "semester", "scheme", "branches"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing columns: ${missing.join(", ")}`] };
  }

  const parsed: SubjectImportRow[] = [];
  rows.forEach((raw, index) => {
    const result = subjectRowSchema.safeParse(raw);
    if (!result.success) {
      errors.push(`Row ${index + 2}: ${result.error.issues.map((issue) => issue.message).join(", ")}`);
      return;
    }
    const branchCodes = result.data.branches
      .split(/[;|]/)
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
    if (branchCodes.length === 0) {
      errors.push(`Row ${index + 2}: no branch codes.`);
      return;
    }
    parsed.push({
      row: index + 2,
      code: result.data.code.toUpperCase(),
      name: result.data.name,
      semester: result.data.semester,
      scheme: result.data.scheme,
      isCommon: result.data.is_common,
      branchCodes,
      sourceUrl: result.data.source_url || "",
    });
  });

  return { rows: parsed, errors };
}

export function parseUnitCsv(text: string): ParseResult<UnitImportRow> {
  const { headers, rows } = parseCsv(text);
  const errors: string[] = [];
  const required = ["code", "unit_no", "title", "topics"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing columns: ${missing.join(", ")}`] };
  }

  const parsed: UnitImportRow[] = [];
  rows.forEach((raw, index) => {
    const result = unitRowSchema.safeParse(raw);
    if (!result.success) {
      errors.push(`Row ${index + 2}: ${result.error.issues.map((issue) => issue.message).join(", ")}`);
      return;
    }
    parsed.push({
      row: index + 2,
      code: result.data.code.toUpperCase(),
      scheme: result.data.scheme ?? "",
      unitNo: result.data.unit_no,
      title: result.data.title,
      topics: result.data.topics
        .split(/[;|\n]/)
        .map((topic) => topic.trim())
        .filter(Boolean),
      sourceUrl: result.data.source_url || "",
    });
  });

  return { rows: parsed, errors };
}

export type ImportSummary = { saved: number; skipped: number; errors: string[] };

// Subjects: inserts new rows, updates unverified rows, never touches verified rows.
export async function importSubjects(rows: SubjectImportRow[]): Promise<ImportSummary> {
  const branches = await all<{ id: number; short_code: string }>("SELECT id, short_code FROM branches");
  const branchId = new Map(branches.map((branch) => [branch.short_code, branch.id]));
  const summary: ImportSummary = { saved: 0, skipped: 0, errors: [] };

  await transaction(async () => {
    for (const row of rows) {
      const missing = row.branchCodes.filter((code) => !branchId.has(code));
      if (missing.length > 0) {
        summary.errors.push(`Row ${row.row} (${row.code}): unknown branch code(s) ${missing.join(", ")}`);
        summary.skipped += 1;
        continue;
      }

      const isSample = row.code.startsWith("SAMPLE") ? 1 : 0;
      await run(
        `INSERT INTO subjects (code, name, semester, scheme, is_common, is_sample, verified, source_url, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))
         ON CONFLICT (code, scheme) DO UPDATE SET
           name = excluded.name,
           semester = excluded.semester,
           is_common = excluded.is_common,
           source_url = COALESCE(NULLIF(excluded.source_url, ''), subjects.source_url),
           fetched_at = excluded.fetched_at
         WHERE subjects.verified = 0`,
        [
          row.code,
          row.name,
          row.semester,
          row.scheme,
          row.isCommon,
          isSample,
          row.sourceUrl || null,
        ],
      );

      const subject = await one<{ id: number; verified: number }>(
        "SELECT id, verified FROM subjects WHERE code = ? AND scheme = ?",
        [row.code, row.scheme],
      );
      if (!subject) {
        summary.errors.push(`Row ${row.row} (${row.code}): could not save the subject.`);
        summary.skipped += 1;
        continue;
      }
      if (subject.verified) {
        summary.skipped += 1;
        continue;
      }

      await run("DELETE FROM subject_branches WHERE subject_id = ?", [subject.id]);
      for (const code of row.branchCodes) {
        const id = branchId.get(code);
        if (!id) continue;
        await run("INSERT OR IGNORE INTO subject_branches (subject_id, branch_id) VALUES (?, ?)", [
          subject.id,
          id,
        ]);
      }
      summary.saved += 1;
    }
  });

  return summary;
}

export async function importUnits(rows: UnitImportRow[]): Promise<ImportSummary> {
  const summary: ImportSummary = { saved: 0, skipped: 0, errors: [] };

  await transaction(async () => {
    for (const row of rows) {
      const matches = await all<{ id: number; verified: number }>(
        row.scheme
          ? "SELECT id, verified FROM subjects WHERE code = ? AND scheme = ?"
          : "SELECT id, verified FROM subjects WHERE code = ?",
        row.scheme ? [row.code, row.scheme] : [row.code],
      );

      if (matches.length === 0) {
        summary.errors.push(`Row ${row.row} (${row.code}): subject not found. Import subjects first.`);
        summary.skipped += 1;
        continue;
      }
      if (matches.length > 1) {
        summary.errors.push(`Row ${row.row} (${row.code}): several schemes match. Add the scheme column.`);
        summary.skipped += 1;
        continue;
      }

      await run(
        `INSERT INTO syllabus_units (subject_id, unit_no, title, topics_json, verified, source_url, fetched_at)
         VALUES (?, ?, ?, ?, 0, ?, datetime('now'))
         ON CONFLICT (subject_id, unit_no) DO UPDATE SET
           title = excluded.title,
           topics_json = excluded.topics_json,
           source_url = COALESCE(NULLIF(excluded.source_url, ''), syllabus_units.source_url),
           fetched_at = excluded.fetched_at
         WHERE syllabus_units.verified = 0`,
        [matches[0].id, row.unitNo, row.title, JSON.stringify(row.topics), row.sourceUrl || null],
      );
      summary.saved += 1;
    }
  });

  return summary;
}
