import { currentVersion } from "./env";

// The cache key is the only thing that decides "does this page already exist?".
// Branch and the user's note are intentionally NOT part of it.
export function cacheKey(subjectId: number, daysOption: number, version = currentVersion()): string {
  return `${subjectId}:${daysOption}:${version}`;
}

export const DAYS_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function isDaysOption(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 10;
}

export function daysLabel(days: number): string {
  return days === 0 ? "Full Syllabus" : days === 1 ? "1 Day" : `${days} Days`;
}

export type TemplateName =
  | "cheat_sheet"
  | "revision_sheet"
  | "important_questions"
  | "numericals"
  | "diagrams"
  | "full_pack";

export type TemplatePlan = {
  templates: TemplateName[];
  questionLimit: number;
  depth: "very_short" | "short" | "medium" | "deep";
};

// How much we ask from the AI depends on how many days the student has.
export function planForDays(days: number): TemplatePlan {
  if (days === 0) {
    return { templates: ["full_pack"], questionLimit: 100, depth: "deep" };
  }
  if (days === 1) {
    return { templates: ["cheat_sheet", "important_questions"], questionLimit: 10, depth: "very_short" };
  }
  if (days === 2) {
    return {
      templates: ["cheat_sheet", "important_questions", "revision_sheet"],
      questionLimit: 15,
      depth: "short",
    };
  }
  if (days <= 5) {
    return {
      templates: ["revision_sheet", "important_questions", "numericals"],
      questionLimit: 25,
      depth: "medium",
    };
  }
  return {
    templates: ["revision_sheet", "important_questions", "numericals", "diagrams"],
    questionLimit: 40,
    depth: "deep",
  };
}

// "Created Nov 2026" style label from the YYYY-MM version.
export function versionLabel(version: string): string {
  const [year, month] = version.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = months[Number(month) - 1] ?? month;
  return `${monthName} ${year}`;
}

export function isOlderVersion(pageVersion: string, newestVersion: string): boolean {
  return pageVersion < newestVersion;
}
