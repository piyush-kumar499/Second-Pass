"use client";

import { useEffect, useState } from "react";

export function ReportButton({ pageId }: { pageId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  async function submit() {
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, reason }),
      });
      const data = await res.json();
      if (!data.ok) {
        setState("error");
        setMessage(data.error ?? "Could not send the report.");
        return;
      }
      setState("sent");
      setMessage(
        data.hidden
          ? "Thanks. This page was hidden and will be reviewed by an admin."
          : "Thanks. An admin will review this page.",
      );
    } catch {
      setState("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-transparent px-1 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-stone-500 underline decoration-line decoration-1 underline-offset-4 transition hover:text-clay"
      >
        Report a mistake
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
          <button
            type="button"
            aria-label="Close report form"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-ink/40 backdrop-blur-[2px] fade-in"
            tabIndex={-1}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            className="sheet-in relative card w-full max-w-md p-4"
          >
            <h2 id="report-title" className="font-serif text-lg font-bold">
              Report this page
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Wrong answers, invented questions, broken diagrams. Pages with 5 reports are hidden
              automatically.
            </p>
            {state === "sent" ? (
              <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                {message}
              </p>
            ) : (
              <>
                <textarea
                  className="input mt-3 min-h-24"
                  maxLength={500}
                  placeholder="What is wrong?"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  autoFocus
                />
                {message ? <p className="mt-2 text-xs text-rose-700">{message}</p> : null}
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={reason.trim().length < 3 || state === "sending"}
                    onClick={() => void submit()}
                  >
                    {state === "sending" ? "Sending…" : "Send report"}
                  </button>
                </div>
              </>
            )}
            {state === "sent" ? (
              <div className="mt-3 text-right">
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
