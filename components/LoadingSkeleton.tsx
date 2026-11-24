// Used by route-level loading.tsx files. Kept out of app/page/[id] so a hidden
// page can answer a real 404 instead of a streamed 200 shell.
export function LoadingSkeleton() {
  return (
    <div className="mt-10 space-y-3">
      <div className="h-6 w-48 animate-pulse rounded-lg bg-stone-200" />
      <div className="h-24 animate-pulse rounded-2xl bg-stone-200/70" />
      <div className="h-24 animate-pulse rounded-2xl bg-stone-200/70" />
    </div>
  );
}
