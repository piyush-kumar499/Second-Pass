import { adminOrError } from "@/lib/admin-guard";
import { getSubject, getUnits } from "@/lib/subjects";
import { buildIngestMessages } from "@/lib/ai/prompts";
import { NoKeysError, runTask } from "@/lib/ai/run";
import { ingestSchema, type IngestQuestion } from "@/lib/schema/ingest";
import { looksGarbled } from "@/lib/questions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Upload a PDF or paste paper text -> AI extracts questions. Nothing is saved here.
export async function POST(request: Request) {
  const guard = await adminOrError();
  if ("response" in guard) return guard.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "Send a form with text or a PDF." }, { status: 400 });
  }

  const subjectId = Number(form.get("subjectId"));
  if (!Number.isInteger(subjectId) || subjectId <= 0) {
    return Response.json({ ok: false, error: "Pick a subject." }, { status: 400 });
  }

  const subject = await getSubject(subjectId);
  if (!subject) return Response.json({ ok: false, error: "Subject not found." }, { status: 404 });

  let rawText = String(form.get("text") ?? "").trim();
  const file = form.get("file");

  if (file instanceof File && file.size > 0) {
    if (file.size > 12 * 1024 * 1024) {
      return Response.json({ ok: false, error: "PDF is larger than 12 MB." }, { status: 413 });
    }
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      rawText = `${rawText}\n\n${result.text ?? ""}`.trim();
    } catch {
      return Response.json(
        { ok: false, error: "Could not read that PDF. Paste the text instead." },
        { status: 422 },
      );
    }
  }

  if (rawText.length < 40) {
    return Response.json(
      { ok: false, error: "Add more paper text (at least a few questions)." },
      { status: 400 },
    );
  }

  const units = await getUnits(subjectId);
  const messages = buildIngestMessages({
    subjectName: subject.name,
    subjectCode: subject.code,
    unitTitles: units.map((unit) => unit.title),
    rawText,
  });

  try {
    const result = await runTask({ task: "ingest", messages, schema: ingestSchema });
    const questions: IngestQuestion[] = (result.data?.questions ?? []).map((question) => {
      const garbled = looksGarbled(question.text);
      return {
        ...question,
        flag: Boolean(question.flag) || garbled,
        flag_reason: garbled
          ? "Text looks garbled — check it against the PDF before saving."
          : question.flag_reason ?? "",
      };
    });
    return Response.json({
      ok: true,
      questions,
      flagged: questions.filter((question) => question.flag).length,
      model: result.model,
    });
  } catch (error) {
    if (error instanceof NoKeysError) {
      return Response.json(
        {
          ok: false,
          error:
            "Paper ingestion needs an AI key. Add GROQ_API3 or GOOGLE_API1, or add questions by hand below.",
        },
        { status: 503 },
      );
    }
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "AI extraction failed." },
      { status: 502 },
    );
  }
}
