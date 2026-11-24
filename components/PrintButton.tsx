"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-line bg-card px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-soft transition hover:bg-paper-deep hover:text-ink"
    >
      Print / PDF
    </button>
  );
}
