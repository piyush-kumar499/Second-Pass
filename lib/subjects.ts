import { all, one } from "./db";

export type Branch = { id: number; name: string; short_code: string };

export type Subject = {
  id: number;
  code: string;
  name: string;
  semester: number;
  scheme: string;
  is_common: number;
  is_sample: number;
  verified: number;
  source_url: string | null;
};

export type SyllabusUnit = {
  id: number;
  subject_id: number;
  unit_no: number;
  title: string;
  topics_json: string;
  verified: number;
};

export type StoredQuestion = {
  id: number;
  text: string;
  marks: number | null;
  year: number | null;
  session: string | null;
  unit_no: number | null;
  hash: string;
  repeat_count?: number;
  years?: string | null;
};

export async function listBranches(): Promise<Branch[]> {
  return all<Branch>("SELECT id, name, short_code FROM branches ORDER BY name");
}

export async function listSubjects(options: {
  branchId?: number;
  semester?: number;
  q?: string;
  limit?: number;
} = {}): Promise<(Subject & { branch_ids: string })[]> {
  const clauses: string[] = [];
  const args: (string | number)[] = [];

  if (options.branchId) {
    clauses.push("s.id IN (SELECT subject_id FROM subject_branches WHERE branch_id = ?)");
    args.push(options.branchId);
  }
  if (options.semester) {
    clauses.push("s.semester = ?");
    args.push(options.semester);
  }
  if (options.q?.trim()) {
    clauses.push("(s.code LIKE ? OR s.name LIKE ?)");
    const like = `%${options.q.trim()}%`;
    args.push(like, like);
  }
  args.push(Math.min(options.limit ?? 30, 60));

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<Subject & { branch_ids: string }>(
    `SELECT s.*, (SELECT GROUP_CONCAT(branch_id) FROM subject_branches sb WHERE sb.subject_id = s.id) AS branch_ids
     FROM subjects s ${where}
     ORDER BY s.semester, s.code
     LIMIT ?`,
    args,
  );
}

export async function getSubject(id: number): Promise<(Subject & { branches: string | null }) | null> {
  return one<Subject & { branches: string | null }>(
    `SELECT s.*,
       (SELECT GROUP_CONCAT(b.short_code, ', ') FROM subject_branches sb
        JOIN branches b ON b.id = sb.branch_id WHERE sb.subject_id = s.id) AS branches
     FROM subjects s WHERE s.id = ?`,
    [id],
  );
}

export async function getUnits(subjectId: number): Promise<SyllabusUnit[]> {
  return all<SyllabusUnit>(
    "SELECT * FROM syllabus_units WHERE subject_id = ? ORDER BY unit_no",
    [subjectId],
  );
}

// Questions grouped by hash: this is how we compute repeat counts in SQL, not with AI.
export async function topQuestions(subjectId: number, limit = 60): Promise<StoredQuestion[]> {
  return all<StoredQuestion>(
    `SELECT hash,
            MIN(text) AS text,
            MAX(marks) AS marks,
            MAX(year) AS year,
            MIN(unit_no) AS unit_no,
            COUNT(*) AS repeat_count,
            GROUP_CONCAT(DISTINCT year) AS years,
            MIN(id) AS id,
            MIN(session) AS session
     FROM questions
     WHERE subject_id = ? AND flagged = 0
     GROUP BY hash
     ORDER BY repeat_count DESC, marks DESC, year DESC
     LIMIT ?`,
    [subjectId, limit],
  );
}

export async function countQuestions(subjectId: number): Promise<number> {
  const row = await one<{ c: number }>(
    "SELECT COUNT(*) AS c FROM questions WHERE subject_id = ? AND flagged = 0",
    [subjectId],
  );
  return row?.c ?? 0;
}

// Full data bundle used to build the AI prompt. Nothing comes from the internet here.
export async function getSubjectBundle(subjectId: number) {
  const subject = await getSubject(subjectId);
  if (!subject) return null;
  const [units, questions, papers] = await Promise.all([
    getUnits(subjectId),
    topQuestions(subjectId, 120),
    all<{ c: number }>("SELECT COUNT(*) AS c FROM papers WHERE subject_id = ?", [subjectId]),
  ]);
  return { subject, units, questions, paperCount: papers[0]?.c ?? 0 };
}

// Used by the admin question list.
export async function listQuestionsForSubject(subjectId: number) {
  return all<StoredQuestion & { flagged: number; verified: number }>(
    `SELECT id, text, marks, year, session, unit_no, hash, flagged, verified
     FROM questions WHERE subject_id = ? ORDER BY unit_no, year DESC, id DESC`,
    [subjectId],
  );
}
