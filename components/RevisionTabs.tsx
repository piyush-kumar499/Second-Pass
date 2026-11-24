"use client";

import { useRef, useState } from "react";
import { BlockList } from "@/components/blocks/BlockRenderer";
import type { RevisionView } from "@/lib/revision-views";

const templateNames: Record<string, string> = {
  cheat_sheet: "Cheat sheet",
  revision_sheet: "Revision notes",
  important_questions: "Important questions",
  numericals: "Numericals",
  diagrams: "Diagrams",
  full_pack: "Full pack",
};

export function RevisionTabs({
  views,
  defaultId,
}: {
  views: RevisionView[];
  defaultId: string;
}) {
  const [active, setActive] = useState(defaultId);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const panelsRef = useRef<HTMLDivElement>(null);

  function select(id: string, focus = false) {
    // If the reader has scrolled deep into a unit, bring the new panel back
    // under the sticky tab strip instead of leaving them mid-panel.
    const top = panelsRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 130) {
      window.scrollTo({ top: window.scrollY + top - 132, behavior: "smooth" });
    }
    setActive(id);
    if (focus) {
      const index = views.findIndex((view) => view.id === id);
      tabRefs.current[index]?.focus();
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = views.findIndex((view) => view.id === active);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % views.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + views.length) % views.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = views.length - 1;
    if (next < 0) return;
    event.preventDefault();
    select(views[next].id, true);
  }

  return (
    <div>
      <div className="no-print sticky top-14 z-20 -mx-4 mt-3 border-y border-line bg-paper/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div
          role="tablist"
          aria-label="Units and study material"
          onKeyDown={onKeyDown}
          className="flex gap-1.5 overflow-x-auto pb-0.5"
        >
          {views.map((view, index) => {
            const selected = view.id === active;
            return (
              <button
                key={view.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`tab-${view.id}`}
                aria-selected={selected}
                aria-controls={`panel-${view.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(view.id)}
                className={`shrink-0 rounded-md border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-wider transition ${
                  selected
                    ? "border-pine-700 bg-pine-600 text-paper shadow-button"
                    : "border-line bg-card text-ink-soft hover:border-pine-300 hover:text-ink"
                }`}
              >
                {view.label}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={panelsRef} className="mt-4 space-y-4">
        {views.map((view) => (
          <div
            key={view.id}
            role="tabpanel"
            id={`panel-${view.id}`}
            aria-labelledby={`tab-${view.id}`}
            hidden={view.id !== active}
            className="print:block"
          >
            <div className="space-y-4">
              {view.sections.map((section, index) => (
                <section
                  key={index}
                  className="card print-block border-l-[3px] border-l-pine-600/60 p-4 sm:p-5"
                >
                  <header className="mb-2 border-b border-line/70 pb-2">
                    <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-pine-700">
                      {templateNames[section.template] ?? section.template}
                      {section.unit_no ? ` · unit ${section.unit_no}` : ""}
                    </p>
                    <h2 className="mt-1 font-serif text-lg font-bold leading-snug sm:text-xl">
                      {section.title}
                    </h2>
                  </header>
                  <BlockList blocks={section.blocks} />
                </section>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
