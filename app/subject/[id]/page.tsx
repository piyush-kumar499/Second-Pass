import Link from "next/link";
import { notFound } from "next/navigation";
import { GenerateCard } from "@/components/GenerateCard";
import { getSubject, getUnits } from "@/lib/subjects";
import { pageSlotsForSubject } from "@/lib/pages";
import { currentUser } from "@/lib/session";
import { currentVersion } from "@/lib/env";
import { DAYS_OPTIONS, daysLabel, versionLabel } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subject = await getSubject(Number(id));
  if (!subject) notFound();
  return { title: `${subject.name} (${subject.code})` };
}

function shortDate(value: string | undefined) {
  if (!value) return "";
  return new Date(String(value).replace(" ", "T") + "Z").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subjectId = Number(id);
  if (!Number.isInteger(subjectId) || subjectId <= 0) notFound();

  const [subject, units, slots, user] = await Promise.all([
    getSubject(subjectId),
    getUnits(subjectId),
    pageSlotsForSubject(subjectId, currentVersion()),
    currentUser(),
  ]);
  if (!subject) notFound();

  const byDays = new Map(slots.map((slot) => [slot.days_option, slot]));

  return (
    <div className="mx-auto max-w-5xl">
      <nav className="font-mono text-[10.5px] uppercase tracking-wider text-stone-500">
        <Link href="/" className="hover:text-pine-700">
          Home
        </Link>{" "}
        <span className="text-stone-300">/</span>{" "}
        <Link href="/browse" className="hover:text-pine-700">
          Subjects
        </Link>{" "}
        <span className="text-stone-300">/</span>{" "}
        <span className="text-ink-soft">{subject.code}</span>
      </nav>

      <header className="mt-4 border-b border-line pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-bold leading-tight tracking-tight sm:text-[2rem]">
              {subject.name}
            </h1>
            <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              {subject.code} · semester {subject.semester} · {subject.scheme}
              {subject.branches ? ` · ${subject.branches}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {subject.is_sample ? (
              <span className="chip border-amber-300 bg-amber-50 text-amber-800">Sample data</span>
            ) : null}
            {subject.verified ? (
              <span className="chip border-emerald-300 bg-emerald-50 text-emerald-800">Verified</span>
            ) : (
              <span className="chip border-clay/40 bg-rose-50 text-clay">Unverified data</span>
            )}
            <span className="chip">v{currentVersion()}</span>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-stone-500">
          {versionLabel(currentVersion())} ·{" "}
          {units.length > 0 ? `${units.length} syllabus units stored` : "no syllabus units yet"}
        </p>
      </header>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-serif text-lg font-bold">Pick your days left</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Ready pages open for free, without login. Missing ones can be generated once.
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
          11 options
        </span>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {DAYS_OPTIONS.map((days) => {
          const slot = byDays.get(days);
          const ready = Boolean(slot);
          return (
            <li
              key={days}
              id={`day-${days}`}
              className={`card relative flex scroll-mt-24 flex-col justify-between overflow-hidden p-3 transition hover:-translate-y-0.5 hover:border-pine-300 ${
                ready ? "border-pine-300" : ""
              }`}
            >
              <span
                className={`absolute inset-x-0 top-0 h-[3px] ${ready ? "bg-pine-600" : "bg-line"}`}
                aria-hidden="true"
              />
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-serif text-[1.7rem] font-bold leading-none">
                    {days === 0 ? "ALL" : days}
                  </p>
                  {ready ? (
                    <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-pine-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-pine-600" />
                      ready
                    </span>
                  ) : (
                    <span className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-stone-400">
                      empty
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs font-semibold text-ink-soft">{daysLabel(days)}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-stone-500">
                  {ready ? shortDate(slot?.created_at) : "Not created yet"}
                </p>
                {slot?.status === "draft" ? (
                  <span className="mt-1 inline-block font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700">
                    AI draft
                  </span>
                ) : null}
              </div>
              <div className="mt-3">
                <GenerateCard
                  subjectId={subject.id}
                  days={days}
                  existingPageId={slot?.id ?? null}
                  loggedIn={Boolean(user)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 max-w-3xl border-t border-dashed border-line pt-3 text-[11px] leading-relaxed text-stone-500">
        A page is generated only if this exact subject, days option and data version has no page yet. If
        someone is already generating it, your screen waits and opens the same page — no second AI call.
      </p>
    </div>
  );
}
