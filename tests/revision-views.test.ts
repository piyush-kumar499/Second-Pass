import "./test-env";
import { describe, expect, it } from "vitest";
import { buildRevisionViews, defaultViewId } from "../lib/revision-views";
import type { Section } from "../lib/schema/page";

function section(input: Partial<Section> & { template: Section["template"] }): Section {
  return {
    title: input.title ?? input.template,
    unit_no: input.unit_no,
    blocks: input.blocks ?? [{ type: "paragraph", text: "text" }],
    template: input.template,
  } as Section;
}

describe("revision tabs", () => {
  it("puts units first, in number order, then study types", () => {
    const { views } = buildRevisionViews([
      section({ template: "important_questions", title: "Important Questions" }),
      section({ template: "revision_sheet", title: "Unit 2", unit_no: 2 }),
      section({ template: "revision_sheet", title: "Unit 1", unit_no: 1 }),
      section({ template: "diagrams", title: "Syllabus Map", unit_no: 0 }),
    ]);

    expect(views.map((view) => view.id)).toEqual([
      "unit-1",
      "unit-2",
      "important",
      "diagrams",
    ]);
    expect(views[0].sections[0].title).toBe("Unit 1");
  });

  it("keeps the draft note out of the tabs", () => {
    const { views, notice } = buildRevisionViews([
      section({ template: "cheat_sheet", title: "About this draft" }),
      section({ template: "cheat_sheet", title: "One-page Cheat Sheet" }),
    ]);

    expect(notice?.title).toBe("About this draft");
    expect(views.map((view) => view.id)).toEqual(["formulas"]);
  });

  it("drops exact duplicate sections saved by older full packs", () => {
    const important = section({ template: "important_questions", title: "Important Questions" });
    const { views } = buildRevisionViews([important, { ...important }]);
    const tab = views.find((view) => view.id === "important");

    expect(tab?.sections).toHaveLength(1);
  });

  it("does not create a Unit 0 tab", () => {
    const { views } = buildRevisionViews([
      section({ template: "diagrams", title: "Syllabus Map", unit_no: 0 }),
    ]);
    expect(views.map((view) => view.id)).toEqual(["diagrams"]);
  });
});

describe("default revision tab", () => {
  it("opens Unit 1 when the page has units", () => {
    const { views } = buildRevisionViews([
      section({ template: "revision_sheet", title: "Unit 1", unit_no: 1 }),
      section({ template: "important_questions", title: "Important Questions" }),
    ]);
    expect(defaultViewId(views)).toBe("unit-1");
  });

  it("opens the cheat sheet on a 1-day page with no units", () => {
    const { views } = buildRevisionViews([
      section({ template: "important_questions", title: "Important Questions" }),
      section({ template: "cheat_sheet", title: "One-page Cheat Sheet" }),
    ]);
    expect(defaultViewId(views)).toBe("formulas");
  });

  it("returns null for an empty page", () => {
    expect(defaultViewId([])).toBeNull();
  });
});
