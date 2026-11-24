import { randomUUID } from "node:crypto";
import { cacheKey, planForDays } from "./cache";
import { currentVersion } from "./env";
import { findPage, insertPage } from "./pages";
import { acquireLock, releaseLock } from "./lock";
import { checkGenLimit, checkGlobalCap, consumeGen, refundGen } from "./limits";
import { getSubjectBundle } from "./subjects";
import { aiPageSchema, pageContentSchema, type PageContent } from "./schema/page";
import { buildGenerateMessages } from "./ai/prompts";
import { runTask, NoKeysError } from "./ai/run";
import { buildMockPage } from "./ai/mock";

export type GenerateOutcome =
  | { status: "created"; pageId: string }
  | { status: "existing"; pageId: string }
  | { status: "locked"; message: string }
  | { status: "limit"; message: string; used: number; limit: number }
  | { status: "cap"; message: string }
  | { status: "error"; message: string; code: "NO_SUBJECT" | "AI_FAILED" };

// The whole generate flow lives here so the API route stays small.
// Cache lookup -> lock -> AI (or mock) -> validate -> save -> release.
export async function generatePage(input: {
  subjectId: number;
  daysOption: number;
  note?: string | null;
  userId: string;
}): Promise<GenerateOutcome> {
  const version = currentVersion();
  const bundle = await getSubjectBundle(input.subjectId);
  if (!bundle) {
    return { status: "error", code: "NO_SUBJECT", message: "That subject does not exist." };
  }

  const existing = await findPage(input.subjectId, input.daysOption, version);
  if (existing) return { status: "existing", pageId: existing.id };

  const cap = await checkGlobalCap();
  if (!cap.ok) return { status: "cap", message: cap.message ?? "Daily AI limit reached." };

  const limit = await checkGenLimit(input.userId);
  if (!limit.ok) {
    return {
      status: "limit",
      message: limit.message ?? "Daily generation limit reached.",
      used: limit.used,
      limit: limit.limit,
    };
  }

  const key = cacheKey(input.subjectId, input.daysOption, version);
  const owner = `${input.userId}:${randomUUID()}`;
  const lock = await acquireLock(key, owner);
  if (!lock.acquired) {
    return { status: "locked", message: "Someone is already creating this page. Hang on a few seconds." };
  }

  let consumed = false;
  try {
    // Re-check after taking the lock: another request may have just finished.
    const again = await findPage(input.subjectId, input.daysOption, version);
    if (again) return { status: "existing", pageId: again.id };

    const capAgain = await checkGlobalCap();
    if (!capAgain.ok) return { status: "cap", message: capAgain.message ?? "Daily AI limit reached." };

    await consumeGen(input.userId);
    consumed = true;

    const plan = planForDays(input.daysOption);
    const messages = buildGenerateMessages({
      subject: bundle.subject,
      units: bundle.units,
      questions: bundle.questions,
      paperCount: bundle.paperCount,
      daysOption: input.daysOption,
      version,
      note: input.note,
      plan,
    });

    let content: PageContent;
    let modelUsed: string;

    try {
      const result = await runTask({
        task: "generate",
        messages,
        schema: aiPageSchema,
      });
      content = {
        meta: {
          subject_code: bundle.subject.code,
          subject_name: bundle.subject.name,
          semester: bundle.subject.semester,
          days_option: input.daysOption,
          version,
          generated_at: new Date().toISOString(),
        },
        sections: result.data?.sections ?? [],
      };
      modelUsed = result.model;

      // Belt and braces: the full page must also pass validation.
      const finalCheck = pageContentSchema.safeParse(content);
      if (!finalCheck.success) throw new Error("The generated page failed final validation.");
    } catch (error) {
      if (error instanceof NoKeysError) {
        content = buildMockPage({
          subject: bundle.subject,
          units: bundle.units,
          questions: bundle.questions,
          daysOption: input.daysOption,
          version,
          plan,
          reason: "The AI is not configured on this server yet.",
        });
        modelUsed = "mock";
      } else {
        throw error;
      }
    }

    const saved = await insertPage({
      subjectId: input.subjectId,
      daysOption: input.daysOption,
      version,
      content,
      modelUsed,
    });
    return { status: "created", pageId: saved.id };
  } catch (error) {
    if (consumed) await refundGen(input.userId);
    return {
      status: "error",
      code: "AI_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Generation failed. Please try again in a minute.",
    };
  } finally {
    await releaseLock(key, owner);
  }
}
