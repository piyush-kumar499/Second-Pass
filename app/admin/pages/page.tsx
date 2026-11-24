import Link from "next/link";
import { all } from "@/lib/db";
import { daysLabel, versionLabel } from "@/lib/cache";
import { currentVersion } from "@/lib/env";
import { changePageStatus } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pages · Admin" };

export default async function AdminPages({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "all";

  const pages = await all<{
    id: string;
    status: string;
    days_option: number;
    version_label: string;
    created_at: string;
    report_count: number;
    view_count: number;
    model_used: string | null;
    code: string;
    name: string;
  }>(
    `SELECT p.id, p.status, p.days_option, p.version_label, p.created_at, p.report_count,
            p.view_count, p.model_used, s.code, s.name
     FROM pages p JOIN subjects s ON s.id = p.subject_id
     ${status !== "all" ? "WHERE p.status = ?" : ""}
     ORDER BY p.created_at DESC LIMIT 100`,
    status !== "all" ? [status] : [],
  );

  const filters = ["all", "draft", "published", "hidden"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {filters.map((filter) => (
          <Link
            key={filter}
            href={filter === "all" ? "/admin/pages" : `/admin/pages?status=${filter}`}
            className={`rounded-full border px-2.5 py-1 font-semibold ${
              status === filter
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-stone-200 bg-white text-stone-600"
            }`}
          >
            {filter}
          </Link>
        ))}
        <span className="ml-auto text-stone-500">Current version {currentVersion()}</span>
      </div>

      <ul className="space-y-2">
        {pages.length === 0 ? <li className="card p-4 text-sm text-stone-600">No pages.</li> : null}
        {pages.map((page) => (
          <li key={page.id} className="card p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/page/${page.id}`} className="text-sm font-semibold hover:underline">
                  {page.name}
                </Link>
                <p className="text-xs text-stone-500">
                  {page.code} · {daysLabel(page.days_option)} · {versionLabel(page.version_label)} ·{" "}
                  {page.view_count} views · {page.model_used ?? "unknown model"}
                </p>
              </div>
              <span
                className={`chip ${
                  page.status === "published"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : page.status === "hidden"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {page.status}
              </span>
            </div>
            {page.report_count > 0 ? (
              <p className="mt-1 text-xs text-rose-600">{page.report_count} report(s)</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {(["published", "draft", "hidden"] as const)
                .filter((value) => value !== page.status)
                .map((value) => (
                  <form key={value} action={changePageStatus}>
                    <input type="hidden" name="id" value={page.id} />
                    <input type="hidden" name="status" value={value} />
                    <button
                      type="submit"
                      className="rounded-lg border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-600 hover:border-stone-400"
                    >
                      {value === "published" ? "Publish" : value === "hidden" ? "Hide" : "Mark draft"}
                    </button>
                  </form>
                ))}
              <Link
                href={`/page/${page.id}`}
                className="rounded-lg border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-600 hover:border-stone-400"
              >
                View
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
