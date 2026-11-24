import Link from "next/link";
import { one, all } from "@/lib/db";
import { aiCallsToday } from "@/lib/limits";
import { globalDailyCap } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const stats = await one<{
    subjects: number;
    units: number;
    questions: number;
    flagged: number;
    pages: number;
    reports: number;
  }>(`SELECT
      (SELECT COUNT(*) FROM subjects) AS subjects,
      (SELECT COUNT(*) FROM syllabus_units) AS units,
      (SELECT COUNT(*) FROM questions) AS questions,
      (SELECT COUNT(*) FROM questions WHERE flagged = 1) AS flagged,
      (SELECT COUNT(*) FROM pages) AS pages,
      (SELECT COUNT(*) FROM page_reports) AS reports`);

  const callsToday = await aiCallsToday();
  const recent = await all<{
    id: string;
    name: string;
    code: string;
    status: string;
    report_count: number;
    created_at: string;
  }>(
    `SELECT p.id, s.name, s.code, p.status, p.report_count, p.created_at
     FROM pages p JOIN subjects s ON s.id = p.subject_id
     ORDER BY p.created_at DESC LIMIT 6`,
  );

  const cards = [
    ["Subjects", stats?.subjects ?? 0, "/admin/subjects"],
    ["Units", stats?.units ?? 0, "/admin/subjects"],
    ["Questions", stats?.questions ?? 0, "/admin/questions"],
    ["Flagged questions", stats?.flagged ?? 0, "/admin/questions?flagged=1"],
    ["Pages", stats?.pages ?? 0, "/admin/pages"],
    ["Reports", stats?.reports ?? 0, "/admin/reports"],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cards.map(([label, value, href]) => (
          <Link key={label} href={href} className="card p-3 hover:border-indigo-300">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-stone-500">{label}</p>
            <p className="mt-1 text-2xl font-black">{value}</p>
          </Link>
        ))}
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-bold">AI calls today</h2>
        <p className="mt-1 text-sm text-stone-600">
          {callsToday} of {globalDailyCap()} used. When the cap is reached, saved pages keep working
          but new generation and chat are blocked until tomorrow (UTC).
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${Math.min(100, (callsToday / Math.max(1, globalDailyCap())) * 100)}%` }}
          />
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Latest pages</h2>
          <Link href="/admin/pages" className="text-xs font-semibold text-indigo-600">
            Manage
          </Link>
        </div>
        <ul className="mt-2 divide-y divide-stone-100 text-sm">
          {recent.length === 0 ? <li className="py-2 text-stone-500">No pages yet.</li> : null}
          {recent.map((page) => (
            <li key={page.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/page/${page.id}`} className="min-w-0 truncate hover:underline">
                {page.name} <span className="text-xs text-stone-500">({page.code})</span>
              </Link>
              <span className="shrink-0 text-xs text-stone-500">
                {page.status}
                {page.report_count > 0 ? ` · ${page.report_count} reports` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white/70 p-4 text-xs leading-relaxed text-stone-600">
        <p className="font-bold text-stone-800">Data rule</p>
        <p className="mt-1">
          Import only what you opened on an official source. Every imported row starts unverified.
          Pages built from unverified data show an &quot;Unverified data&quot; badge.
        </p>
      </div>
    </div>
  );
}
