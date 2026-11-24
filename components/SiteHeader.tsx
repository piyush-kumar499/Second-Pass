import Link from "next/link";
import { currentUser } from "@/lib/session";
import { signOut } from "@/lib/auth";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";

export async function SiteHeader() {
  const user = await currentUser();
  const initial = (user?.name ?? user?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-pine-800 bg-pine-600 text-paper shadow-button">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
              <path
                d="M7.5 3.75h6.25L18 8v11.25a1 1 0 0 1-1 1H7.5a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M13.5 4v4.25H18M9.5 12h5M9.5 15.25h3.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block truncate font-serif text-[15px] font-bold leading-none sm:text-base">
              {SITE_NAME}
            </span>
            <span className="mt-1 hidden font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft sm:block">
              {SITE_TAGLINE}
            </span>
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-0.5 text-sm">
          <Link
            href="/browse"
            className="rounded-md px-2.5 py-2 text-ink-soft transition hover:bg-paper-deep hover:text-ink"
          >
            Browse
          </Link>
          {user?.isAdmin ? (
            <Link
              href="/admin"
              className="rounded-md px-2.5 py-2 text-ink-soft transition hover:bg-paper-deep hover:text-ink"
            >
              Admin
            </Link>
          ) : null}
          {user ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
              className="flex items-center gap-1"
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-full border border-line bg-paper-deep font-mono text-[11px] font-bold text-ink-soft"
                title={user.email}
              >
                {initial}
              </span>
              <button
                type="submit"
                aria-label="Sign out"
                className="hidden rounded-md px-2.5 py-2 text-ink-soft transition hover:bg-paper-deep hover:text-ink sm:inline"
              >
                Sign out
              </button>
              <button
                type="submit"
                aria-label="Sign out"
                className="grid h-8 w-8 place-items-center rounded-md text-ink-soft transition hover:bg-paper-deep hover:text-ink sm:hidden"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
                  <path
                    d="M15 5h3a2 2 0 012 2v10a2 2 0 01-2 2h-3M10 8l-4 4 4 4M6 12h10"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </form>
          ) : (
            <Link href="/login" className="btn-primary !px-3 !py-1.5 text-xs">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
