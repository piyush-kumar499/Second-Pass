"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Branch } from "@/lib/subjects";

type SubjectResult = {
  id: number;
  code: string;
  name: string;
  semester: number;
  scheme: string;
  is_sample: number;
};

const DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function StepTitle({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <span className="label">
      <span className="step-dot">{step}</span>
      {children}
    </span>
  );
}

export function HomeWizard({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [branchId, setBranchId] = useState<string>("");
  const [semester, setSemester] = useState<string>("");
  const [query, setQuery] = useState("");
  const [subjects, setSubjects] = useState<SubjectResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SubjectResult | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"idle" | "creating" | "polling">("idle");
  const pollAbort = useRef<AbortController | null>(null);

  // Debounced subject search. Empty query still lists some subjects.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (branchId) params.set("branch", branchId);
        if (semester) params.set("semester", semester);
        const res = await fetch(`/api/subjects?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.ok) setSubjects(data.subjects as SubjectResult[]);
      } catch {
        // Aborted or offline: keep the old list.
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, branchId, semester]);

  useEffect(() => () => pollAbort.current?.abort(), []);

  async function pollForPage(subjectId: number, daysOption: number) {
    setBusy("polling");
    const controller = new AbortController();
    pollAbort.current = controller;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (controller.signal.aborted) return;
      try {
        const res = await fetch(`/api/pages/status?subjectId=${subjectId}&days=${daysOption}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.ok && data.exists) {
          router.push(`/page/${data.pageId}`);
          return;
        }
      } catch {
        // keep trying unless aborted
      }
    }
    setBusy("idle");
    setError("This is taking longer than usual. Check the subject page in a few minutes.");
  }

  async function handleGenerate() {
    setError("");
    if (!selected) {
      setError("Pick a subject first.");
      return;
    }
    if (days === null) {
      router.push(`/subject/${selected.id}`);
      return;
    }

    setBusy("creating");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: selected.id,
          daysOption: days,
          note: note.trim() || undefined,
        }),
      });

      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/subject/${selected.id}#day-${days}`)}`);
        return;
      }

      const data = await res.json();
      if (res.status === 202 || data.status === "locked") {
        await pollForPage(selected.id, days);
        return;
      }
      if (data.ok && data.pageId) {
        router.push(`/page/${data.pageId}`);
        return;
      }
      setBusy("idle");
      setError(data.error ?? "Could not generate the page. Please try again.");
    } catch {
      setBusy("idle");
      setError("Network error. Check your connection and try again.");
    }
  }

  const busyLabel =
    busy === "creating"
      ? "Starting the AI…"
      : busy === "polling"
        ? "Another student is creating this page. Waiting for it…"
        : "";

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-4 sm:p-6">
        <div>
          <StepTitle step={1}>Where are you studying?</StepTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Branch</span>
              <select
                className="input"
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setSelected(null);
                }}
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Semester</span>
              <select
                className="input"
                value={semester}
                onChange={(event) => {
                  setSemester(event.target.value);
                  setSelected(null);
                }}
              >
                <option value="">All semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                  <option key={value} value={value}>
                    Semester {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="border-t border-dashed border-line pt-5">
          <StepTitle step={2}>Find the subject</StepTitle>
          <input
            className="input"
            placeholder="Search by code or name, e.g. KCS301"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search subjects"
          />

          <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-line bg-card">
            {searching && subjects.length === 0 ? (
              <p className="p-3 font-mono text-[11px] uppercase tracking-wider text-stone-400">
                Searching…
              </p>
            ) : subjects.length === 0 ? (
              <p className="p-3 text-sm text-ink-soft">
                No subjects found. Try another branch or semester.
              </p>
            ) : (
              <ul className="divide-y divide-line/70">
                {subjects.map((subject) => {
                  const active = selected?.id === subject.id;
                  return (
                    <li key={subject.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(subject)}
                        aria-pressed={active}
                        className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-paper ${
                          active ? "border-l-[3px] border-pine-600 bg-pine-50/70 pl-[9px]" : ""
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{subject.name}</span>
                          <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-wider text-stone-500">
                            {subject.code} · sem {subject.semester} · {subject.scheme}
                            {subject.is_sample ? " · sample data" : ""}
                          </span>
                        </span>
                        {active ? (
                          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-pine-700">
                            picked
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-dashed border-line pt-5">
          <StepTitle step={3}>How many days are left?</StepTitle>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(days === value ? null : value)}
                className={`h-10 w-10 rounded-md border font-mono text-sm font-bold transition ${
                  days === value
                    ? "border-pine-700 bg-pine-600 text-paper shadow-button"
                    : "border-line bg-card text-ink-soft hover:border-pine-300 hover:text-ink"
                }`}
                aria-pressed={days === value}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDays(null)}
              className={`h-10 rounded-md border px-3 text-xs font-semibold transition ${
                days === null
                  ? "border-pine-700 bg-pine-600 text-paper shadow-button"
                  : "border-line bg-card text-ink-soft hover:border-pine-300 hover:text-ink"
              }`}
              aria-pressed={days === null}
            >
              Not sure
            </button>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            With &quot;Not sure&quot; you see all 11 options for the subject and pick one.
          </p>
        </div>

        <div className="border-t border-dashed border-line pt-5">
          <label className="block">
            <StepTitle step={4}>
              Anything to focus on? <span className="font-sans normal-case tracking-normal text-stone-400">(optional)</span>
            </StepTitle>
            <textarea
              className="input min-h-20 resize-y"
              maxLength={300}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Unit 3 numericals and last year's 7-mark questions"
            />
          </label>
          <div className="mt-1 flex flex-col gap-1 text-[11px] text-stone-500 sm:flex-row sm:justify-between">
            <span>The note is a hint only. It does not change which page is saved.</span>
            <span className="font-mono">{note.length}/300</span>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-paper/70 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!selected || busy !== "idle"}
          className="btn-primary w-full sm:w-auto"
        >
          {busy !== "idle"
            ? "Working…"
            : days === null
              ? "See the 11 options →"
              : `Generate ${days}-day revision →`}
        </button>
        {busy !== "idle" ? (
          <p className="text-sm text-ink-soft">{busyLabel}</p>
        ) : (
          <p className="text-[11px] leading-relaxed text-stone-500">
            Pages are saved once and shared with everyone after that, so the AI is not called twice.
          </p>
        )}
      </div>
    </div>
  );
}
