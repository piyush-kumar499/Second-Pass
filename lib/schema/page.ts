import { z } from "zod";

// Every page stored in `pages.content_json` must pass this schema.
// Keep the limits generous but finite so a bad AI response cannot blow up the page.

const shortText = z.string().trim().min(1).max(2000);
const longText = z.string().trim().min(1).max(6000);
const optionalText = z.string().trim().max(200).optional();

export const templateNames = [
  "cheat_sheet",
  "revision_sheet",
  "important_questions",
  "numericals",
  "diagrams",
  "full_pack",
] as const;

const headingBlock = z.object({
  type: z.literal("heading"),
  text: shortText,
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
});

const paragraphBlock = z.object({ type: z.literal("paragraph"), text: longText });

const bulletsBlock = z.object({
  type: z.literal("bullets"),
  items: z.array(shortText).min(1).max(40),
});

const formulaBlock = z.object({
  type: z.literal("formula"),
  latex: z.string().trim().min(1).max(2000),
  caption: optionalText,
});

const mermaidBlock = z.object({
  type: z.literal("mermaid"),
  code: z.string().trim().min(1).max(6000),
  caption: optionalText,
});

const tableBlock = z.object({
  type: z.literal("table"),
  headers: z.array(shortText).min(1).max(8),
  rows: z.array(z.array(z.string().trim().max(2000)).min(1).max(8)).min(1).max(60),
});

const noteBlock = z.object({
  type: z.literal("note"),
  kind: z.enum(["tip", "warning", "exam_hint"]),
  text: longText,
});

const numericalBlock = z.object({
  type: z.literal("numerical"),
  problem: longText,
  steps: z.array(longText).min(1).max(20),
  final_answer: z.string().trim().min(1).max(2000),
});

// Answer blocks are deliberately a subset of blocks (no nested questions, no headings).
const answerBlock = z.union([
  paragraphBlock,
  bulletsBlock,
  formulaBlock,
  tableBlock,
  noteBlock,
  numericalBlock,
  mermaidBlock,
]);

export const qaBlock = z.object({
  type: z.literal("qa"),
  question: longText,
  marks: z.number().int().min(1).max(100).optional(),
  year: z.number().int().min(1990).max(2100).optional(),
  answer_blocks: z.array(answerBlock).min(1).max(12),
});

export const blockSchema = z.union([
  headingBlock,
  paragraphBlock,
  bulletsBlock,
  qaBlock,
  numericalBlock,
  formulaBlock,
  mermaidBlock,
  tableBlock,
  noteBlock,
]);

export type Block = z.infer<typeof blockSchema>;
export type QAValue = z.infer<typeof qaBlock>;
export type NumericalValue = z.infer<typeof numericalBlock>;
export type NoteValue = z.infer<typeof noteBlock>;

export const sectionSchema = z.object({
  template: z.enum(templateNames),
  title: shortText,
  unit_no: z.number().int().min(0).max(20).optional(),
  blocks: z.array(blockSchema).min(1).max(80),
});

export const pageMetaSchema = z.object({
  subject_code: z.string().trim().min(1).max(40),
  subject_name: z.string().trim().min(1).max(200),
  semester: z.number().int().min(1).max(8),
  days_option: z.number().int().min(0).max(10),
  version: z.string().regex(/^\d{4}-\d{2}$/),
  generated_at: z.string(),
  sample: z.boolean().optional(),
});

export const pageContentSchema = z.object({
  meta: pageMetaSchema,
  sections: z.array(sectionSchema).min(1).max(80),
});

export type PageContent = z.infer<typeof pageContentSchema>;
export type Section = z.infer<typeof sectionSchema>;

// What we ask the AI for. Meta is added by the server, never by the model.
export const aiPageSchema = z.object({
  sections: z.array(sectionSchema).min(1).max(80),
});

export type AIPage = z.infer<typeof aiPageSchema>;

// One-line summary of what was wrong, fed back to the model on the single retry.
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 12)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}
