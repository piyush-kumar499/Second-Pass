import Link from "next/link";
import { listPublicPages } from "@/lib/pages";
import { daysLabel, versionLabel } from "@/lib/cache";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Browse revision pages",
  description: "All saved revision pages, free to read without login.",
};

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 60);
  const pages = await listPublicPages({ q, limit: 80 });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="border-b border-line pb-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-pine-700">
          The shelf
        </p>
        <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl">
          Browse saved pages
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          No login needed. Every page is filed by subject and days left.
        </p>
      </div>

      <form className="mt-4 flex gap-2" action="/browse">
        <input
          className="input"
          name="q"
          defaultValue={q}
          placeholder="Search subject code or name"
          aria-label="Search saved pages"
        />
        <button type="submit" className="btn-primary shrink-0">
          Search
        </button>
      </form>

      {pages.length === 0 ? (
        <div className="card mt-5 p-8 text-center">
          <p className="font-serif text-lg font-bold">No pages on this shelf yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            {q ? "Try a different code or name." : "Be the first to generate one from the home page."}
          </p>
          <Link href="/" className="btn-primary mt-4">
            Go to home
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-stone-400">
            <span>{pages.length} page{pages.length === 1 ? "" : "s"}</span>
            <span>newest first</span>
          </div>
          <ul className="mt-1 divide-y divide-line/70 border-t border-line">
            {pages.map((page) => (
              <li key={page.id}>
                <Link
                  href={`/page/${page.id}`}
                  className="group flex items-start gap-3 py-3.5 transition hover:bg-card/70"
                >
                  <span className="mt-0.5 w-14 shrink-0 font-mono text-[10px] uppercase tracking-wider text-stone-400">
                    {page.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold group-hover:text-pine-700">
                      {page.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-soft">
                      Sem {page.semester} · {daysLabel(page.days_option)} · {page.view_count} views
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-stone-400">
                      {versionLabel(page.version_label)}
                      {page.subject_sample ? " · sample data" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 self-center font-mono text-xs text-stone-400 transition group-hover:text-pine-700">
                    read →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
