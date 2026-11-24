"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Message = { id: number | string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Explain Unit 2 in simple words",
  "Which 7-mark questions are most likely?",
  "List every formula I need",
  "Give me a 10-minute revision plan",
];

function SparkIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15.4l-1.6-4.6L6 9.2l4.4-1.6L12 3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" fill="currentColor" />
    </svg>
  );
}

function SendIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 12l16-7-6 16-3-6-7-3z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatWidget({
  pageId,
  subjectName,
  loggedIn,
  initialMessages,
}: {
  pageId: string;
  subjectName: string;
  loggedIn: boolean;
  initialMessages: Message[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const localIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    fabRef.current?.focus();
  }, []);

  // Close on Escape and keep the page behind the sheet from scrolling.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  // Focus the field (or the close button when logged out) once the sheet is open.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      target?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, busy, open]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    localIdRef.current += 1;
    const localId = `local-${localIdRef.current}`;
    setBusy(true);
    setError("");
    setInput("");
    setMessages((current) => [...current, { id: localId, role: "user", content: message }]);

    // On any failure the local bubble is removed and the text goes back into
    // the box, so nobody thinks a message was saved when it was not.
    function fail(reason: string) {
      setMessages((current) => current.filter((item) => item.id !== localId));
      setInput(message);
      setError(reason);
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, message }),
      });
      const data = await res.json();
      if (!data.ok) {
        fail(data.error ?? "Could not send the message.");
        return;
      }
      setMessages(data.messages as Message[]);
    } catch {
      fail("Network error. Your message was not sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="ai-chat-panel"
        className="no-print fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full border border-pine-800 bg-pine-600 py-3 pl-4 pr-4 text-paper shadow-[0_10px_24px_-8px_rgba(25,63,52,0.65)] transition hover:-translate-y-0.5 hover:bg-pine-700 sm:bottom-6 sm:right-6"
      >
        <SparkIcon />
        <span className="text-sm font-semibold">Ask AI</span>
        <span className="sr-only">about this revision page</span>
      </button>

      {open ? (
        <div className="no-print fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close the AI chat"
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-ink/40 backdrop-blur-[2px] fade-in"
            tabIndex={-1}
          />
          <div
            id="ai-chat-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-chat-title"
            className="sheet-in absolute inset-x-0 bottom-0 flex h-[86dvh] max-h-[42rem] flex-col overflow-hidden rounded-t-xl border border-line bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[32rem] sm:w-[25rem] sm:rounded-lg sm:pb-0"
          >
            <span
              className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden"
              aria-hidden="true"
            />
            <header className="flex items-start gap-3 border-b border-line bg-paper px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-pine-800 bg-pine-600 text-paper">
                <SparkIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="ai-chat-title" className="font-serif text-base font-bold leading-none">
                  Revision assistant
                </h2>
                <p className="mt-1 truncate font-mono text-[9.5px] uppercase tracking-wider text-ink-soft">
                  {subjectName}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close chat"
                data-autofocus={loggedIn ? undefined : true}
                className="-mr-1 grid h-8 w-8 place-items-center rounded-md text-lg leading-none text-ink-soft transition hover:bg-paper-deep hover:text-ink"
              >
                ×
              </button>
            </header>

            {!loggedIn ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-line bg-paper text-ink-soft">
                  <SparkIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-serif text-lg font-bold">Log in to ask</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Reading is free. The assistant needs an account so your chat history can be saved.
                  </p>
                </div>
                <Link
                  href={`/login?next=${encodeURIComponent(pathname ?? "/")}`}
                  className="btn-primary"
                  onClick={close}
                >
                  Login to chat →
                </Link>
              </div>
            ) : (
              <>
                <div
                  ref={scrollRef}
                  className="chat-scroll flex-1 space-y-3 overflow-y-auto bg-paper/60 px-3 py-3"
                >
                  {messages.length === 0 ? (
                    <div className="px-1 py-2">
                      <p className="text-sm leading-relaxed text-ink-soft">
                        Ask anything about this subject or the page. Answers are short and based on what
                        is written here.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => void send(suggestion)}
                            disabled={busy}
                            className="rounded-full border border-line bg-card px-2.5 py-1 text-left text-[11px] text-ink-soft transition hover:border-pine-300 hover:text-ink disabled:opacity-50"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`max-w-[92%] ${message.role === "user" ? "ml-auto" : "mr-auto"}`}
                      >
                        <p
                          className={`mb-1 font-mono text-[9px] uppercase tracking-wider ${
                            message.role === "user" ? "text-right text-stone-400" : "text-pine-700"
                          }`}
                        >
                          {message.role === "user" ? "you" : "assistant"}
                        </p>
                        <div
                          className={`whitespace-pre-line rounded-lg px-3 py-2 text-[13.5px] leading-relaxed ${
                            message.role === "user"
                              ? "rounded-br-sm border border-pine-700 bg-pine-600 text-paper"
                              : "rounded-bl-sm border border-line bg-card text-ink"
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    ))
                  )}
                  {busy ? (
                    <div className="mr-auto max-w-[92%]">
                      <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-pine-700">
                        assistant
                      </p>
                      <div className="inline-flex items-center gap-1.5 rounded-lg rounded-bl-sm border border-line bg-card px-3 py-2.5">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.2s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.1s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" />
                        <span className="sr-only">Thinking</span>
                      </div>
                    </div>
                  ) : null}
                  <div aria-live="polite" className="sr-only">
                    {busy ? "The assistant is thinking" : ""}
                  </div>
                </div>

                {error ? (
                  <p className="border-t border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    {error}
                  </p>
                ) : null}

                <div className="border-t border-line bg-card p-2">
                  <div className="flex items-end gap-1.5">
                    <textarea
                      ref={inputRef}
                      data-autofocus
                      className="input max-h-28 min-h-[2.75rem] resize-none !rounded-md !py-2 text-[13.5px]"
                      rows={1}
                      maxLength={1000}
                      placeholder="Ask about this page…"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void send();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={busy || !input.trim()}
                      className="btn-primary !px-3 !py-2.5"
                      aria-label="Send message"
                    >
                      <SendIcon />
                    </button>
                  </div>
                  <p className="mt-1 px-1 font-mono text-[9px] uppercase tracking-wider text-stone-400">
                    enter to send · shift+enter for a new line
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
