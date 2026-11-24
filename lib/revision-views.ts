import type { Section } from "./schema/page";

export type RevisionView = {
  id: string;
  label: string;
  sections: Section[];
};

// The page is one long list of sections. Turn it into tabs: one per unit, then
// one per study type (important questions, formulas, numericals, diagrams).
// Every section lands in exactly one tab, and the draft note is shown above.
//
// This is intentionally a plain function over the saved page JSON: switching
// tabs never calls the AI and works for pages generated months ago.
export function buildRevisionViews(sections: Section[]): {
  views: RevisionView[];
  notice: Section | null;
} {
  const units = new Map<number, Section[]>();
  const important: Section[] = [];
  const formulas: Section[] = [];
  const numericals: Section[] = [];
  const diagrams: Section[] = [];
  const notes: Section[] = [];
  let notice: Section | null = null;
  const seen = new Set<string>();

  for (const section of sections) {
    // Older full-pack pages saved the questions section twice. Ignore exact
    // repeats so a tab never shows the same block twice.
    const signature = JSON.stringify(section);
    if (seen.has(signature)) continue;
    seen.add(signature);

    if (
      section.template === "cheat_sheet" &&
      section.title.trim().toLowerCase() === "about this draft"
    ) {
      notice = section;
      continue;
    }
    if (section.unit_no && section.unit_no > 0) {
      const list = units.get(section.unit_no) ?? [];
      list.push(section);
      units.set(section.unit_no, list);
      continue;
    }
    switch (section.template) {
      case "important_questions":
        important.push(section);
        break;
      case "cheat_sheet":
        formulas.push(section);
        break;
      case "numericals":
        numericals.push(section);
        break;
      case "diagrams":
        diagrams.push(section);
        break;
      default:
        notes.push(section);
    }
  }

  const views: RevisionView[] = [];
  for (const [unit, list] of [...units.entries()].sort((a, b) => a[0] - b[0])) {
    views.push({ id: `unit-${unit}`, label: `Unit ${unit}`, sections: list });
  }
  if (important.length > 0) {
    views.push({ id: "important", label: "Most important", sections: important });
  }
  if (formulas.length > 0) views.push({ id: "formulas", label: "Formulas", sections: formulas });
  if (numericals.length > 0) {
    views.push({ id: "numericals", label: "Numericals", sections: numericals });
  }
  if (diagrams.length > 0) views.push({ id: "diagrams", label: "Diagrams", sections: diagrams });
  if (notes.length > 0) views.push({ id: "notes", label: "Notes", sections: notes });

  return { views, notice };
}

// Unit 1 is the first thing a student sees. Pages without units (1-day plans)
// open on the cheat sheet, because that is the revision material they have.
export function defaultViewId(views: RevisionView[]): string | null {
  return (
    views.find((view) => view.id === "unit-1")?.id ??
    views.find((view) => view.id === "formulas")?.id ??
    views[0]?.id ??
    null
  );
}
