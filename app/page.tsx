import Link from "next/link";
import { HomeWizard } from "@/components/HomeWizard";
import { listBranches } from "@/lib/subjects";
import { currentVersion } from "@/lib/env";
import { all, one } from "@/lib/db";
import { daysLabel } from "@/lib/cache";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [branches, subjectCount, pageCount, recent] = await Promise.all([
    listBranches(),
    one<{ c: number }>("SELECT COUNT(*) AS c FROM subjects"),
    one<{ c: number }>("SELECT COUNT(*) AS c FROM pages WHERE status != 'hidden'"),
    all<{ id: string; code: string; name: string; days_option: number; created_at: string }>(
      `SELECT p.id, s.code, s.name, p.days_option, p.created_at
       FROM pages p JOIN subjects s ON s.id = p.subject_id
       WHERE p.status != 'hidden' AND p.version_label = ?
       ORDER BY p.created_at DESC LIMIT 5`,
      [currentVersion()],
    ),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <section className="grid gap-7 pt-2 lg:grid-cols-[1.4fr_0.85fr] lg:items-start lg:gap-10 lg:pt-6">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-pine-700">
            B.Tech · exam revision notebook
          </p>
          <h1 className="mt-3 font-serif text-[2.15rem] font-bold leading-[1.08] tracking-tight sm:text-5xl">
            Revise the <span className="marker">right things</span>
            <span className="mt-1 block text-stone-400">in the days you have left.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft">
            Pick your branch, semester and subject. Open a page with important questions, short notes,
            formulas, numericals and diagrams — sized to the days left before the exam. Every page is
            generated once, then shared for free.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10.5px] uppercase tracking-wider text-ink-soft">
            <span className="border-b-2 border-highlight pb-0.5">
              {subjectCount?.c ?? 0} subjects stored
            </span>
            <span className="border-b-2 border-highlight pb-0.5">
              {pageCount?.c ?? 0} pages saved
            </span>
            <span className="text-stone-400">data version {currentVersion()}</span>
          </div>
        </div>

        <aside className="paper-note mx-1 mt-2 rotate-[-0.6deg] lg:mt-1">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
            How to use this
          </p>
          <ol className="mt-3 space-y-2.5 text-sm leading-snug text-ink">
            {[
              "Pick your subject and how many days are left.",
              "Open the saved page, or ask for it once.",
              "Read the short version first, then the questions.",
              "Print it if you revise better on paper.",
            ].map((line, index) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="step-dot">{index + 1}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-dashed border-line pt-2.5 font-serif text-xs italic leading-relaxed text-stone-500">
            One page, one sitting. Do not read everything twice.
          </p>
          <Link href="/browse" className="mt-3 inline-block text-xs font-semibold text-pine-700 hover:underline">
            Or browse what is already saved →
          </Link>
        </aside>
      </section>

      <section className="mt-8 sm:mt-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold">Build your revision page</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              Five small steps. Nothing is charged, and reading never needs a login.
            </p>
          </div>
          <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-wider text-stone-400 sm:block">
            reading is free
          </span>
        </div>
        <HomeWizard branches={branches} />
      </section>

      {branches.length === 0 ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          The database has no subjects yet. Run <code className="font-mono">npm run db:migrate</code>{" "}
          then <code className="font-mono">npm run db:seed</code> to load sample data.
        </div>
      ) : null}

      {recent.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-baseline justify-between border-b border-line pb-2">
            <h2 className="font-serif text-xl font-bold">Freshly written</h2>
            <Link href="/browse" className="font-mono text-[10.5px] uppercase tracking-wider text-pine-700 hover:underline">
              Browse all
            </Link>
          </div>
          <ul className="mt-1 divide-y divide-line/70">
            {recent.map((page) => (
              <li key={page.id}>
                <Link
                  href={`/page/${page.id}`}
                  className="group flex items-center gap-3 py-3 transition hover:bg-card/70"
                >
                  <span className="w-16 shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-stone-400">
                    {page.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold group-hover:text-pine-700">
                      {page.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-soft">
                      {daysLabel(page.days_option)} before the exam
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-stone-400 transition group-hover:text-pine-700">
                    open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          ["Saved once, not guessed twice", "If a page already exists it opens instantly. No AI call, no waiting."],
          ["Built from stored data", "Prompts use only the syllabus and past questions in this database."],
          ["Marked as a draft", "Every AI page says so until a human checks it. Sample rows say sample."],
        ].map(([title, text], index) => (
          <div key={title} className="border-t-2 border-pine-600/70 pt-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
              0{index + 1}
            </p>
            <p className="mt-1 font-serif text-sm font-bold">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
