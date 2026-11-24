"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PreviewRow = Record<string, unknown>;
type Summary = { saved: number; skipped: number; errors: string[] };

const samples = {
  subjects: `code,name,semester,scheme,is_common,branches,source_url
SAMPLE201,Sample Physics,1,2024-25,1,CSE;IT;ECE,https://example.com/syllabus
SAMPLE202,Sample Mechanics,3,2024-25,0,ME,https://example.com/syllabus`,
  units: `code,scheme,unit_no,title,topics,source_url
SAMPLE201,2024-25,1,Sample Unit One,"topic a; topic b; topic c",https://example.com/syllabus
SAMPLE201,2024-25,2,Sample Unit Two,"topic d; topic e",https://example.com/syllabus`,
};

export function ImportPanel() {
  const router = useRouter();
  const [type, setType] = useState<"subjects" | "units">("subjects");
  const [csv, setCsv] = useState(samples.subjects);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("");

  async function preview() {
    setBusy(true);
    setSummary(null);
    setMessage("");
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, csv }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.error ?? "Could not read the CSV.");
        setRows(null);
        return;
      }
      setRows(data.rows as PreviewRow[]);
      setErrors(data.errors as string[]);
    } catch {
      setMessage("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, csv }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.error ?? "Import failed.");
        return;
      }
      setSummary(data.summary as Summary);
      setRows(null);
      router.refresh();
    } catch {
      setMessage("Network error.");
    } finally {
      setBusy(false);
    }
  }

  function switchType(next: "subjects" | "units") {
    setType(next);
    setCsv(samples[next]);
    setRows(null);
    setErrors([]);
    setSummary(null);
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">CSV import</h2>
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => switchType("subjects")}
            className={`rounded-lg px-2.5 py-1 font-semibold ${type === "subjects" ? "bg-indigo-600 text-white" : "bg-stone-100 text-stone-600"}`}
          >
            Subjects
          </button>
          <button
            type="button"
            onClick={() => switchType("units")}
            className={`rounded-lg px-2.5 py-1 font-semibold ${type === "units" ? "bg-indigo-600 text-white" : "bg-stone-100 text-stone-600"}`}
          >
            Syllabus units
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-stone-600">
        {type === "subjects"
          ? "Columns: code, name, semester, scheme, is_common, branches (semicolon separated), source_url. Subjects imported twice update only while unverified."
          : "Columns: code, scheme (optional), unit_no, title, topics (semicolon separated), source_url. Import subjects first."}
      </p>

      <textarea
        className="input mt-2 min-h-32 font-mono !text-xs"
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
        spellCheck={false}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={() => void preview()} disabled={busy}>
          {busy ? "Reading…" : "Preview"}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void commit()}
          disabled={busy || !rows || rows.length === 0}
        >
          Save {rows ? `${rows.length} row(s)` : ""}
        </button>
        <span className="self-center text-xs text-stone-500">Nothing is written until you press Save.</span>
      </div>

      {message ? <p className="mt-2 text-xs text-rose-700">{message}</p> : null}

      {errors.length > 0 ? (
        <ul className="mt-2 space-y-1 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {summary ? (
        <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
          Saved {summary.saved}, skipped {summary.skipped}.
          {summary.errors.length > 0 ? (
            <ul className="mt-1 list-disc pl-4">
              {summary.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {rows && rows.length > 0 ? (
        <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-stone-50 text-stone-500">
              <tr>
                {Object.keys(rows[0]).map((header) => (
                  <th key={header} className="whitespace-nowrap px-2 py-1.5 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row, index) => (
                <tr key={index}>
                  {Object.keys(rows[0]).map((header) => (
                    <td key={header} className="max-w-[14rem] truncate px-2 py-1.5">
                      {Array.isArray(row[header]) ? (row[header] as unknown[]).join(", ") : String(row[header] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
