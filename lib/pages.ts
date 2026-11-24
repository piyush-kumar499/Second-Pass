import { randomUUID } from "node:crypto";
import { all, one, run } from "./db";
import { currentVersion } from "./env";
import { isDaysOption } from "./cache";
import type { PageContent } from "./schema/page";

export type PageRow = {
  id: string;
  subject_id: number;
  days_option: number;
  version_label: string;
  status: "draft" | "published" | "hidden";
  content_json: string;
  model_used: string | null;
  view_count: number;
  report_count: number;
  created_at: string;
};

export type PageWithSubject = PageRow & {
  code: string;
  name: string;
  semester: number;
  subject_verified: number;
  subject_sample: number;
  units_verified: number | null;
  questions_unverified: number;
};

export const AUTO_HIDE_REPORTS = 5;

export async function findPage(
  subjectId: number,
  daysOption: number,
  version = currentVersion(),
): Promise<PageRow | null> {
  return one<PageRow>(
    "SELECT * FROM pages WHERE subject_id = ? AND days_option = ? AND version_label = ?",
    [subjectId, daysOption, version],
  );
}

export async function getPage(id: string): Promise<PageWithSubject | null> {
  return one<PageWithSubject>(
    `SELECT p.*, s.code, s.name, s.semester,
            s.verified AS subject_verified, s.is_sample AS subject_sample,
            (SELECT MIN(u.verified) FROM syllabus_units u WHERE u.subject_id = p.subject_id) AS units_verified,
            (SELECT COUNT(*) FROM questions q
              WHERE q.subject_id = p.subject_id AND q.flagged = 0 AND q.verified = 0) AS questions_unverified
     FROM pages p JOIN subjects s ON s.id = p.subject_id
     WHERE p.id = ?`,
    [id],
  );
}

// Cards on /subject/[id]: every days option with its status for the current version.
export async function pageSlotsForSubject(subjectId: number, version = currentVersion()) {
  const rows = await all<{
    days_option: number;
    id: string;
    status: string;
    created_at: string;
    report_count: number;
  }>(
    `SELECT days_option, id, status, created_at, report_count
     FROM pages WHERE subject_id = ? AND version_label = ?`,
    [subjectId, version],
  );
  return rows;
}

// A newer version of the same page, if it exists.
export async function newerVersionOf(page: PageRow): Promise<PageRow | null> {
  return one<PageRow>(
    `SELECT * FROM pages
     WHERE subject_id = ? AND days_option = ? AND version_label > ? AND status != 'hidden'
     ORDER BY version_label DESC LIMIT 1`,
    [page.subject_id, page.days_option, page.version_label],
  );
}

export async function insertPage(input: {
  subjectId: number;
  daysOption: number;
  version: string;
  content: PageContent;
  modelUsed: string;
}): Promise<PageRow> {
  const id = randomUUID();
  try {
    await run(
      `INSERT INTO pages (id, subject_id, days_option, version_label, status, content_json, model_used)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      [
        id,
        input.subjectId,
        input.daysOption,
        input.version,
        JSON.stringify(input.content),
        input.modelUsed,
      ],
    );
  } catch (error) {
    // UNIQUE race: another request saved the page first, so reuse it.
    const existing = await findPage(input.subjectId, input.daysOption, input.version);
    if (existing) return existing;
    throw error;
  }
  const row = await one<PageRow>("SELECT * FROM pages WHERE id = ?", [id]);
  if (!row) throw new Error("Page insert failed");
  return row;
}

export async function incrementView(id: string): Promise<void> {
  await run("UPDATE pages SET view_count = view_count + 1 WHERE id = ?", [id]);
}

export async function setPageStatus(id: string, status: "draft" | "published" | "hidden") {
  await run("UPDATE pages SET status = ? WHERE id = ?", [status, id]);
}

// Public pages: drafts are visible (they are AI drafts), hidden pages never are.
export async function listPublicPages(options: { q?: string; limit?: number } = {}) {
  const args: (string | number)[] = [];
  let where = "WHERE p.status != 'hidden' AND p.version_label = ?";
  args.push(currentVersion());
  if (options.q?.trim()) {
    where += " AND (s.code LIKE ? OR s.name LIKE ?)";
    const like = `%${options.q.trim()}%`;
    args.push(like, like);
  }
  args.push(Math.min(options.limit ?? 60, 100));

  return all<PageRow & { code: string; name: string; semester: number; subject_sample: number }>(
    `SELECT p.*, s.code, s.name, s.semester, s.is_sample AS subject_sample
     FROM pages p JOIN subjects s ON s.id = p.subject_id
     ${where}
     ORDER BY p.created_at DESC LIMIT ?`,
    args,
  );
}

export async function reportPage(input: {
  pageId: string;
  userId: string | null;
  reason: string;
}): Promise<{ reports: number; hidden: boolean }> {
  await run("INSERT INTO page_reports (page_id, user_id, reason) VALUES (?, ?, ?)", [
    input.pageId,
    input.userId,
    input.reason,
  ]);
  await run("UPDATE pages SET report_count = report_count + 1 WHERE id = ?", [input.pageId]);
  const row = await one<{ report_count: number }>(
    "SELECT report_count FROM pages WHERE id = ?",
    [input.pageId],
  );
  const reports = row?.report_count ?? 0;
  if (reports >= AUTO_HIDE_REPORTS) {
    await run("UPDATE pages SET status = 'hidden' WHERE id = ? AND status != 'hidden'", [
      input.pageId,
    ]);
    return { reports, hidden: true };
  }
  return { reports, hidden: false };
}

export function parseContent(row: PageRow): PageContent | null {
  try {
    return JSON.parse(row.content_json) as PageContent;
  } catch {
    return null;
  }
}

export { isDaysOption };
