import { z } from "zod";

// Shape of the ingest model output. Kept loose enough for real OCR text.
export const ingestQuestionSchema = z.object({
  text: z.string().trim().min(5).max(2000),
  marks: z.number().int().min(1).max(100).nullable().optional(),
  unit_no: z.number().int().min(1).max(10).nullable().optional(),
  year: z.number().int().min(1990).max(2100).nullable().optional(),
  session: z.string().trim().max(40).nullable().optional(),
  flag: z.boolean().optional().default(false),
  flag_reason: z.string().trim().max(300).optional().default(""),
});

export const ingestSchema = z.object({
  questions: z.array(ingestQuestionSchema).max(200),
});

export type IngestQuestion = z.infer<typeof ingestQuestionSchema>;

export const commitQuestionsSchema = z.object({
  subjectId: z.coerce.number().int().positive(),
  session: z.string().trim().min(2).max(40),
  year: z.coerce.number().int().min(1990).max(2100).optional(),
  sourceUrl: z.string().trim().url().optional().or(z.literal("")),
  sourceNote: z.string().trim().max(200).optional(),
  questions: z
    .array(
      z.object({
        text: z.string().trim().min(5).max(2000),
        marks: z.coerce.number().int().min(1).max(100).optional().nullable(),
        unitNo: z.coerce.number().int().min(1).max(10).optional().nullable(),
        year: z.coerce.number().int().min(1990).max(2100).optional().nullable(),
        flag: z.boolean().optional(),
        flagReason: z.string().trim().max(300).optional(),
      }),
    )
    .min(1)
    .max(200),
});
