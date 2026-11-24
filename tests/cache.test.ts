import "./test-env";
import { describe, expect, it } from "vitest";
import { cacheKey, daysLabel, isOlderVersion, planForDays, versionLabel } from "../lib/cache";

describe("cache key", () => {
  it("depends only on subject, days and version", () => {
    expect(cacheKey(12, 3, "2026-11")).toBe("12:3:2026-11");
  });

  it("is the same for a different branch or a note (they are not inputs)", () => {
    const branchA = cacheKey(7, 5, "2026-11");
    const branchB = cacheKey(7, 5, "2026-11");
    expect(branchA).toBe(branchB);
    expect(branchA).not.toContain("branch");
  });

  it("changes with a new version", () => {
    expect(cacheKey(7, 5, "2026-11")).not.toBe(cacheKey(7, 5, "2026-12"));
  });
});

describe("days plan", () => {
  it("maps 1 day to cheat sheet + top 10 questions", () => {
    const plan = planForDays(1);
    expect(plan.templates).toEqual(["cheat_sheet", "important_questions"]);
    expect(plan.questionLimit).toBe(10);
  });

  it("maps 2 days to top 15", () => {
    expect(planForDays(2).questionLimit).toBe(15);
  });

  it("maps 3 to 5 days to medium plan", () => {
    expect(planForDays(3).templates).toContain("numericals");
    expect(planForDays(5).depth).toBe("medium");
  });

  it("maps 6 to 10 days to the deep plan with diagrams", () => {
    expect(planForDays(6).templates).toContain("diagrams");
    expect(planForDays(10).depth).toBe("deep");
  });

  it("maps 0 to the full pack", () => {
    expect(planForDays(0).templates).toEqual(["full_pack"]);
  });
});

describe("labels", () => {
  it("formats a version label", () => {
    expect(versionLabel("2026-11")).toBe("Nov 2026");
  });

  it("labels days", () => {
    expect(daysLabel(0)).toBe("Full Syllabus");
    expect(daysLabel(1)).toBe("1 Day");
    expect(daysLabel(7)).toBe("7 Days");
  });

  it("detects older versions", () => {
    expect(isOlderVersion("2026-10", "2026-11")).toBe(true);
    expect(isOlderVersion("2026-11", "2026-11")).toBe(false);
  });
});
