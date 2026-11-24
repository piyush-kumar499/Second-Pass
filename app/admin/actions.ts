"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { run } from "@/lib/db";
import { setPageStatus } from "@/lib/pages";

async function ensureAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("Admin only.");
  return admin;
}

export async function changePageStatus(formData: FormData) {
  await ensureAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["draft", "published", "hidden"].includes(status)) return;
  await setPageStatus(id, status as "draft" | "published" | "hidden");
  revalidatePath("/admin/pages");
  revalidatePath("/browse");
  revalidatePath(`/page/${id}`);
}

export async function setQuestionVerified(formData: FormData) {
  await ensureAdmin();
  const id = Number(formData.get("id"));
  const verified = formData.get("verified") === "1" ? 1 : 0;
  if (!Number.isInteger(id)) return;
  await run("UPDATE questions SET verified = ? WHERE id = ?", [verified, id]);
  revalidatePath("/admin/questions");
}

export async function toggleQuestionFlag(formData: FormData) {
  await ensureAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await run(
    "UPDATE questions SET flagged = CASE WHEN flagged = 1 THEN 0 ELSE 1 END, flag_reason = CASE WHEN flagged = 1 THEN NULL ELSE 'Flagged by admin' END WHERE id = ?",
    [id],
  );
  revalidatePath("/admin/questions");
}

export async function deleteQuestion(formData: FormData) {
  await ensureAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await run("DELETE FROM questions WHERE id = ?", [id]);
  revalidatePath("/admin/questions");
}

export async function dismissReports(formData: FormData) {
  await ensureAdmin();
  const pageId = String(formData.get("pageId") ?? "");
  if (!pageId) return;
  await run("DELETE FROM page_reports WHERE page_id = ?", [pageId]);
  await run("UPDATE pages SET report_count = 0 WHERE id = ?", [pageId]);
  revalidatePath("/admin/reports");
  revalidatePath("/admin/pages");
}

export async function hideReportedPage(formData: FormData) {
  await ensureAdmin();
  const pageId = String(formData.get("pageId") ?? "");
  if (!pageId) return;
  await run("DELETE FROM page_reports WHERE page_id = ?", [pageId]);
  await run("UPDATE pages SET report_count = 0, status = 'hidden' WHERE id = ?", [pageId]);
  revalidatePath("/admin/reports");
  revalidatePath("/admin/pages");
  revalidatePath("/browse");
}

export async function publishReportedPage(formData: FormData) {
  await ensureAdmin();
  const pageId = String(formData.get("pageId") ?? "");
  if (!pageId) return;
  await run("DELETE FROM page_reports WHERE page_id = ?", [pageId]);
  await run("UPDATE pages SET report_count = 0, status = 'published' WHERE id = ?", [pageId]);
  revalidatePath("/admin/reports");
  revalidatePath("/admin/pages");
}

export async function verifySubject(formData: FormData) {
  await ensureAdmin();
  const id = Number(formData.get("id"));
  const verified = formData.get("verified") === "1" ? 1 : 0;
  if (!Number.isInteger(id)) return;
  await run("UPDATE subjects SET verified = ? WHERE id = ?", [verified, id]);
  revalidatePath("/admin/subjects");
}
