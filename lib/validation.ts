import { z } from "zod";

export const generateInputSchema = z.object({
  subjectId: z.coerce.number().int().positive(),
  daysOption: z.coerce.number().int().min(0).max(10),
  note: z.string().trim().max(300).optional().nullable(),
});

export const chatInputSchema = z.object({
  pageId: z.string().uuid(),
  message: z.string().trim().min(1).max(1000),
});

export const reportInputSchema = z.object({
  pageId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

export const statusQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive(),
  days: z.coerce.number().int().min(0).max(10),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().max(60).optional().default(""),
  branch: z.coerce.number().int().positive().optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
});

export function badRequest(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}
