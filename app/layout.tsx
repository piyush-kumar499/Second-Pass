import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "katex/dist/katex.min.css";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8f3e8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">{children}</main>
        <footer className="no-print mt-10 border-t border-line bg-paper-deep/50">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:grid-cols-[1.6fr_1fr] sm:px-6">
            <div>
              <p className="font-serif text-base font-bold">{SITE_NAME}</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-soft">
                Made for B.Tech students revising on a deadline. Pages are AI drafts built from the
                official AKTU syllabus and past-paper data stored here — always cross-check with your
                teacher and the syllabus.
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-stone-500">
                Not affiliated with AKTU · no exam paper PDFs are hosted
              </p>
            </div>
            <div className="flex flex-col gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-soft sm:items-end">
              <Link href="/browse" className="hover:text-pine-700">
                Browse saved pages
              </Link>
              <Link href="/login" className="hover:text-pine-700">
                Log in
              </Link>
              <span className="text-stone-400">Updated for the 2026-11 data version</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
