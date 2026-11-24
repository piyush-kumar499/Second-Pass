"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SubjectOption = { id: number; code: string; name: string; semester: number };

type Row = {
  key: number;
  text: string;
  marks: string;
  unitNo: string;
  year: string;
  flag: boolean;
  flagReason: string;
};

let nextKey = 1;
const blankRow = (): Row => ({
  key: nextKey++,
  text: "",
  marks: "",
  unitNo: "",
  year: "",
  flag: false,
  flagReason: "",
});

export function IngestPanel({ subjects }: { subjects: SubjectOption[] }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState("");
  const [session, setSession] = useState("2025-26 Odd");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [sourceUrl, setSourceUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function extract() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("subjectId", subjectId);
      form.set("text", text);
      if (file) form.set("file", file);
      const res = await fetch("/api/admin/ingest", { method: "POST", body: form });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Extraction failed.");
        if (rows.length === 0) setRows([blankRow()]);
        return;
      }
      const extracted = (data.questions as Array<{
        text: string;
        marks?: number | null;
        unit_no?: number | null;
        year?: number | null;
        flag?: boolean;
        flag_reason?: string;
      }>).map((question) => ({
        key: nextKey++,
        text: question.text,
        marks: question.marks ? String(question.marks) : "",
        unitNo: question.unit_no ? String(question.unit_no) : "",
        year: question.year ? String(question.year) : year,
        flag: Boolean(question.flag),
        flagReason: question.flag_reason ?? "",
      }));
      setRows(extracted);
      setMessage(
        `Extracted ${extracted.length} question(s)${data.flagged ? `, ${data.flagged} flagged` : ""}. Check them before saving.`,
      );
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const cleanRows = rows.filter((row) => row.text.trim().length >= 5);
      if (cleanRows.length === 0) {
        setError("Add at least one question.");
        return;
      }
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: Number(subjectId),
          session,
          year: year ? Number(year) : undefined,
          sourceUrl,
          sourceNote: file ? file.name : "Pasted paper text",
          questions: cleanRows.map((row) => ({
            text: row.text,
            marks: row.marks ? Number(row.marks) : null,
            unitNo: row.unitNo ? Number(row.unitNo) : null,
            year: row.year ? Number(row.year) : null,
            flag: row.flag,
            flagReason: row.flagReason,
          })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setMessage(`Saved ${data.saved}, skipped ${data.skipped} duplicate(s), flagged ${data.flagged}.`);
      setRows([]);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (subjects.length === 0) {
    return (
      <div className="card p-4 text-sm text-stone-600">
        Add subjects in <strong>Subjects &amp; syllabus</strong> before importing papers.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="text-sm font-bold">1 · Paper details</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Subject</span>
            <select className="input" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              <option value="">Pick a subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} · {subject.name} (sem {subject.semester})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Session</span>
            <input className="input" value={session} onChange={(event) => setSession(event.target.value)} placeholder="2024-25 Odd" />
          </label>
          <label className="block">
            <span className="label">Year</span>
            <input className="input" value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric" />
          </label>
          <label className="block">
            <span className="label">Source URL (optional, official page)</span>
            <input className="input" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://aktu.ac.in/..." />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="label">Paper PDF (optional) or paste text below</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="block w-full text-xs"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <textarea
          className="input mt-2 min-h-28 font-mono !text-xs"
          placeholder="Paste the extracted paper text here if you do not upload a PDF"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void extract()}
            disabled={busy || !subjectId || (!text.trim() && !file)}
          >
            {busy ? "Working…" : "Extract questions with AI"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setRows((current) => [...current, blankRow()])}>
            Add a question by hand
          </button>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Extraction needs an AI key. Without one, add questions by hand — nothing is invented.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2">
            <h2 className="text-sm font-bold">2 · Review before saving</h2>
            <span className="text-xs text-stone-500">{rows.length} question(s)</span>
          </div>
          <ul className="divide-y divide-stone-100">
            {rows.map((row) => (
              <li key={row.key} className="p-3">
                <textarea
                  className="input min-h-16 !text-sm"
                  value={row.text}
                  onChange={(event) => updateRow(row.key, { text: event.target.value })}
                />
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="label">Marks</span>
                    <input
                      className="input !py-1.5"
                      inputMode="numeric"
                      value={row.marks}
                      onChange={(event) => updateRow(row.key, { marks: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="label">Unit</span>
                    <input
                      className="input !py-1.5"
                      inputMode="numeric"
                      value={row.unitNo}
                      onChange={(event) => updateRow(row.key, { unitNo: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="label">Year</span>
                    <input
                      className="input !py-1.5"
                      inputMode="numeric"
                      value={row.year}
                      onChange={(event) => updateRow(row.key, { year: event.target.value })}
                    />
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 text-amber-700">
                    <input
                      type="checkbox"
                      checked={row.flag}
                      onChange={(event) => updateRow(row.key, { flag: event.target.checked })}
                    />
                    Flag (garbled / check text)
                  </label>
                  <button
                    type="button"
                    className="text-rose-600 hover:underline"
                    onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                  >
                    Remove
                  </button>
                </div>
                {row.flag && row.flagReason ? (
                  <p className="mt-1 text-xs text-amber-700">{row.flagReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 p-3">
            <button type="button" className="btn-primary" onClick={() => void commit()} disabled={busy || !subjectId}>
              Save questions
            </button>
            <button type="button" className="btn-ghost" onClick={() => setRows((current) => [...current, blankRow()])}>
              Add row
            </button>
            <span className="text-xs text-stone-500">Saved as unverified. Duplicate text is skipped.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
