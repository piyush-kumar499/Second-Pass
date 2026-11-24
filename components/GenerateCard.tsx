"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function GenerateCard({
  subjectId,
  days,
  existingPageId,
  loggedIn,
}: {
  subjectId: number;
  days: number;
  existingPageId: string | null;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "creating" | "polling" | "error">("idle");
  const [message, setMessage] = useState("");

  if (existingPageId) {
    return (
      <Link href={`/page/${existingPageId}`} className="btn-primary w-full !py-2 text-xs">
        Open page →
      </Link>
    );
  }

  async function start() {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/subject/${subjectId}#day-${days}`)}`);
      return;
    }
    setState("creating");
    setMessage("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, daysOption: days }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/subject/${subjectId}#day-${days}`)}`);
        return;
      }
      const data = await res.json();
      if (data.ok && data.pageId) {
        router.push(`/page/${data.pageId}`);
        return;
      }
      if (data.status === "locked") {
        setState("polling");
        for (let attempt = 0; attempt < 40; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const check = await fetch(`/api/pages/status?subjectId=${subjectId}&days=${days}`);
          const status = await check.json();
          if (status.ok && status.exists) {
            router.push(`/page/${status.pageId}`);
            return;
          }
        }
        setState("error");
        setMessage("Still not ready. Try again in a minute.");
        return;
      }
      setState("error");
      setMessage(data.error ?? "Could not start. Try again.");
    } catch {
      setState("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={start}
        disabled={state === "creating" || state === "polling"}
        className="btn-ghost w-full !py-2 text-xs"
      >
        {state === "creating" ? "Starting…" : state === "polling" ? "Creating…" : "Create page"}
      </button>
      {message ? <p className="text-[10.5px] leading-tight text-clay">{message}</p> : null}
      {!loggedIn ? (
        <p className="font-mono text-[9px] uppercase tracking-wider text-stone-400">login needed</p>
      ) : null}
    </div>
  );
}
