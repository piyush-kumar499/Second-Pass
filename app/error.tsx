"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-12 max-w-md p-6 text-center">
      <h1 className="text-lg font-bold">Something broke</h1>
      <p className="mt-1 text-sm text-stone-600">
        The page hit an error. Try again; if it keeps happening, check the server logs.
      </p>
      <button type="button" onClick={reset} className="btn-primary mt-4">
        Try again
      </button>
    </div>
  );
}
