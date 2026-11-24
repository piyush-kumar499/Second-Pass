import Link from "next/link";
import { all } from "@/lib/db";
import { dismissReports, hideReportedPage, publishReportedPage } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports · Admin" };

export default async function AdminReports() {
  const reports = await all<{
    id: number;
    page_id: string;
    reason: string;
    created_at: string;
    user_id: string | null;
    status: string;
    report_count: number;
    code: string;
    name: string;
  }>(
    `SELECT r.id, r.page_id, r.reason, r.created_at, r.user_id,
            p.status, p.report_count, s.code, s.name
     FROM page_reports r
     JOIN pages p ON p.id = r.page_id
     JOIN subjects s ON s.id = p.subject_id
     ORDER BY r.created_at DESC LIMIT 200`,
  );

  // One group per page, newest reports first.
  const grouped = new Map<string, typeof reports>();
  for (const report of reports) {
    const list = grouped.get(report.page_id) ?? [];
    list.push(report);
    grouped.set(report.page_id, list);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        A page is hidden automatically at 5 reports. Dismissing clears every report for that page.
      </p>
      <p className="text-xs text-stone-400">
        {reports.length} report(s) across {grouped.size} page(s)
      </p>

      {grouped.size === 0 ? <div className="card p-4 text-sm text-stone-600">No reports. Good.</div> : null}

      {[...grouped.entries()].map(([pageId, items]) => {
        const first = items[0];
        return (
          <div key={pageId} className="card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/page/${pageId}`} className="text-sm font-semibold hover:underline">
                  {first.name}
                </Link>
                <p className="text-xs text-stone-500">
                  {first.code} · {first.status} · {items.length} report(s)
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <form action={dismissReports}>
                  <input type="hidden" name="pageId" value={pageId} />
                  <button type="submit" className="rounded-lg border border-stone-300 px-2 py-1 font-semibold text-stone-600">
                    Dismiss reports
                  </button>
                </form>
                <form action={publishReportedPage}>
                  <input type="hidden" name="pageId" value={pageId} />
                  <button type="submit" className="rounded-lg border border-emerald-300 px-2 py-1 font-semibold text-emerald-700">
                    Publish page
                  </button>
                </form>
                <form action={hideReportedPage}>
                  <input type="hidden" name="pageId" value={pageId} />
                  <button type="submit" className="rounded-lg border border-rose-300 px-2 py-1 font-semibold text-rose-700">
                    Hide page
                  </button>
                </form>
              </div>
            </div>
            <ul className="mt-2 space-y-1 border-t border-stone-100 pt-2 text-xs text-stone-600">
              {items.map((report) => (
                <li key={report.id}>
                  <span className="text-stone-400">
                    {report.created_at} {report.user_id ? "· logged in" : "· guest"}:
                  </span>{" "}
                  {report.reason}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
