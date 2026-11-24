import type { PageContent, Section } from "../schema/page";
import type { StoredQuestion, Subject, SyllabusUnit } from "../subjects";
import type { TemplatePlan } from "../cache";

// Used only when no AI keys exist (local development) or the AI day cap is hit.
// It never invents exam questions: it turns stored syllabus rows into a placeholder page.

type MockInput = {
  subject: Subject;
  units: SyllabusUnit[];
  questions: StoredQuestion[];
  daysOption: number;
  version: string;
  plan: TemplatePlan;
  reason: string;
};

function unitTopics(unit: SyllabusUnit): string[] {
  try {
    return JSON.parse(unit.topics_json) as string[];
  } catch {
    return [];
  }
}

function topicsSection(unit: SyllabusUnit): Section {
  const topics = unitTopics(unit);
  return {
    template: "revision_sheet",
    title: `Unit ${unit.unit_no}: ${unit.title}`,
    unit_no: unit.unit_no,
    blocks: [
      {
        type: "paragraph",
        text: `${unit.title} — topics listed in the syllabus.`,
      },
      {
        type: "bullets",
        items: topics.length > 0 ? topics.slice(0, 20) : ["Topics for this unit are not stored yet."],
      },
      { type: "note", kind: "tip", text: "Write 3 key formulas or definitions for this unit from your class notes." },
    ],
  };
}

function importantQuestions(questions: StoredQuestion[], limit: number): Section {
  if (questions.length === 0) {
    return {
      template: "important_questions",
      title: "Important Questions",
      blocks: [{ type: "note", kind: "warning", text: "No verified past papers yet." }],
    };
  }
  return {
    template: "important_questions",
    title: "Important Questions",
    blocks: questions.slice(0, limit).map((question) => ({
      type: "qa" as const,
      question: question.text,
      marks: question.marks ?? undefined,
      year: question.year ?? undefined,
      answer_blocks: [
        {
          type: "paragraph" as const,
          text: `Model answer is not available in sample mode. This question was asked ${question.repeat_count ?? 1} time(s)${question.years ? ` (${question.years})` : ""}.`,
        },
      ],
    })),
  };
}

function diagramSection(units: SyllabusUnit[]): Section {
  const lines = ["flowchart TD", `  S[${"Syllabus"}]`];
  units.forEach((unit) => {
    const safe = unit.title.replace(/[[\]"()]/g, " ");
    lines.push(`  U${unit.unit_no}[Unit ${unit.unit_no}: ${safe}]`);
    lines.push(`  S --> U${unit.unit_no}`);
  });
  if (units.length === 0) lines.push("  S --> Nothing[No units stored]");
  return {
    template: "diagrams",
    title: "Syllabus Map",
    unit_no: 0,
    blocks: [
      { type: "mermaid", code: lines.join("\n"), caption: "How the units fit together (generated from stored units)" },
    ],
  };
}

export function buildMockPage(input: MockInput): PageContent {
  const { subject, units, questions, daysOption, version, plan } = input;

  const header: Section = {
    template: "cheat_sheet",
    title: "About this draft",
    blocks: [
      {
        type: "note",
        kind: "warning",
        text: `${input.reason} You are seeing a syllabus-only draft. Add AI keys in .env or use the admin tools to import verified past papers.`,
      },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["Subject", `${subject.name} (${subject.code})`],
          ["Semester", String(subject.semester)],
          ["Days left", daysOption === 0 ? "Full syllabus" : String(daysOption)],
          ["Version", version],
        ],
      },
      {
        type: "formula",
        latex: "\\text{KaTeX preview: } (a+b)^2 = a^2 + 2ab + b^2",
        caption: "Rendering check for sample mode. Real pages use formulas from the syllabus.",
      },
    ],
  };

  const revision = units.length > 0 ? units.map(topicsSection) : [topicsSection({
    id: 0,
    subject_id: subject.id,
    unit_no: 1,
    title: "Syllabus",
    topics_json: "[]",
    verified: 0,
  })];

  const questionsSection = importantQuestions(questions, plan.questionLimit);

  const numericalNote: Section = {
    template: "numericals",
    title: "Numericals",
    blocks: [
      {
        type: "note",
        kind: "tip",
        text: "Practice numericals are written by the AI from stored syllabus topics. In sample mode there are none yet.",
      },
    ],
  };

  let sections: Section[] = [header];
  if (plan.templates.includes("cheat_sheet")) {
    sections.push({
      template: "cheat_sheet",
      title: "One-page Cheat Sheet",
      blocks: [
        {
          type: "table",
          headers: ["Unit", "Topics to revise"],
          rows: units.map((unit) => [`Unit ${unit.unit_no}`, unitTopics(unit).join(", ").slice(0, 400) || unit.title]),
        },
      ],
    });
  }
  if (plan.templates.includes("revision_sheet")) sections = sections.concat(revision);
  // The full pack adds the questions section itself; do not add it twice.
  if (plan.templates.includes("important_questions")) {
    sections.push(questionsSection);
  }
  if (plan.templates.includes("numericals")) sections.push(numericalNote);
  if (plan.templates.includes("diagrams")) sections.push(diagramSection(units));
  if (plan.templates.includes("full_pack")) {
    sections = sections.concat(revision, [questionsSection, numericalNote, diagramSection(units)]);
  }

  return {
    meta: {
      subject_code: subject.code,
      subject_name: subject.name,
      semester: subject.semester,
      days_option: daysOption,
      version,
      generated_at: new Date().toISOString(),
      sample: true,
    },
    sections,
  };
}
