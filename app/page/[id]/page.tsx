import Link from "next/link";
import { notFound } from "next/navigation";
import { BlockList } from "@/components/blocks/BlockRenderer";
import { ChatWidget } from "@/components/ChatWidget";
import { RevisionTabs } from "@/components/RevisionTabs";
import { PrintButton } from "@/components/PrintButton";
import { ReportButton } from "@/components/ReportButton";
import { getChatHistory } from "@/lib/chat";
import { daysLabel, versionLabel } from "@/lib/cache";
import { getPage, incrementView, newerVersionOf, parseContent } from "@/lib/pages";
import { pageContentSchema } from "@/lib/schema/page";
import { buildRevisionViews, defaultViewId } from "@/lib/revision-views";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getPage(id);
  if (!page) return { title: "Page not found" };
  // Resolve the 404 before the shell streams, so a hidden page really answers 404.
  const user = await currentUser();
  if (page.status === "hidden" && !user?.isAdmin) notFound();
  return {
    title: `${page.name} — ${daysLabel(page.days_option)} revision`,
    description: `Saved revision page for ${page.name} (${page.code}), ${daysLabel(page.days_option)} before the exam.`,
  };
}

export default async function RevisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getPage(id);
  if (!page) notFound();

  const user = await currentUser();
  if (page.status === "hidden" && !user?.isAdmin) notFound();

  const parsed = pageContentSchema.safeParse(parseContent(page));
  if (!parsed.success) {
    return (
      <div className="card mx-auto mt-8 max-w-lg p-6 text-sm">
        <h1 className="font-serif text-lg font-bold">This page could not be displayed</h1>
        <p className="mt-2 text-ink-soft">
          The saved content does not match the expected format. An admin can regenerate or hide it.
        </p>
        <Link href={`/subject/${page.subject_id}`} className="btn-primary mt-4">
          Back to the subject
        </Link>
      </div>
    );
  }

  const content = parsed.data;
  const [newer, history] = await Promise.all([
    newerVersionOf(page),
    user ? getChatHistory(user.id, page.id, 50) : Promise.resolve([]),
  ]);
  void incrementView(page.id);

  const { views, notice } = buildRevisionViews(content.sections);
  const startView = defaultViewId(views);
  const isDraft = page.status === "draft";
  const unverified =
    !page.subject_verified ||
    page.units_verified === 0 ||
    page.questions_unverified > 0 ||
    content.meta.sample;

  return (
    <div className="mx-auto max-w-3xl pb-20">
      <nav className="no-print font-mono text-[10.5px] uppercase tracking-wider text-stone-500">
        <Link href="/" className="hover:text-pine-700">
          Home
        </Link>{" "}
        <span className="text-stone-300">/</span>{" "}
        <Link href={`/subject/${page.subject_id}`} className="hover:text-pine-700">
          {page.code}
        </Link>{" "}
        <span className="text-stone-300">/</span>{" "}
        <span className="text-ink-soft">{daysLabel(page.days_option)}</span>
      </nav>

      <div className="no-print mt-3 flex flex-wrap items-center gap-1.5">
        <span className="chip">Created {versionLabel(page.version_label)}</span>
        {isDraft ? (
          <span className="chip border-amber-300 bg-amber-50 text-amber-800">AI draft · not verified</span>
        ) : (
          <span className="chip border-emerald-300 bg-emerald-50 text-emerald-800">Verified</span>
        )}
        {unverified ? (
          <span className="chip border-clay/40 bg-rose-50 text-clay">Unverified data</span>
        ) : null}
        {content.meta.sample ? (
          <span className="chip border-amber-300 bg-amber-50 text-amber-800">Sample page</span>
        ) : null}
        {newer ? (
          <Link href={`/page/${newer.id}`} className="chip border-pine-300 bg-pine-50 text-pine-700">
            Older version · open {versionLabel(newer.version_label)}
          </Link>
        ) : null}
        {page.status === "hidden" ? (
          <span className="chip border-rose-300 bg-rose-50 text-rose-700">Hidden · admin preview</span>
        ) : null}
      </div>

      <header className="print-block mt-3 border-b border-line pb-4">
        <h1 className="font-serif text-[1.75rem] font-bold leading-[1.15] tracking-tight sm:text-4xl">
          {page.name}
        </h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
          {page.code} · semester {page.semester} · {daysLabel(page.days_option)} left
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Read the short version first. Long answers and numericals come after it.
        </p>
      </header>

      <div className="no-print mt-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-card/80 px-2.5 py-1.5">
        <PrintButton />
        <span className="h-4 w-px bg-line" aria-hidden="true" />
        <ReportButton pageId={page.id} />
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-stone-400">
          {page.view_count + 1} views
        </span>
      </div>

      <div id="top" className="scroll-mt-28">
        {notice ? (
          <section className="card-quiet print-block mt-4 p-3">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              About this page
            </p>
            <div className="mt-2">
              <BlockList blocks={notice.blocks} />
            </div>
          </section>
        ) : null}

        {startView ? (
          <RevisionTabs views={views} defaultId={startView} />
        ) : (
          <p className="card mt-4 p-5 text-sm text-ink-soft">
            This page has no revision sections yet. It can be regenerated by an admin.
          </p>
        )}
      </div>

      <p className="no-print mt-6 border-t border-dashed border-line pt-4 text-center font-mono text-[9.5px] uppercase tracking-[0.16em] text-stone-400">
        {views.length} tabs · switch units above · ask the ai bubble for doubts
      </p>

      <ChatWidget
        pageId={page.id}
        subjectName={`${page.name} (${page.code})`}
        loggedIn={Boolean(user)}
        initialMessages={history.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
        }))}
      />
    </div>
  );
}
