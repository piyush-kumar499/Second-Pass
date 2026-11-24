import { generatePage } from "@/lib/generate";
import { currentUser } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { badRequest, generateInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ ok: false, code: "LOGIN_REQUIRED", error: "Please log in to generate a page." }, { status: 401 });
  }

  // Cheap protection against double-clicks and scripted abuse.
  const limit = rateLimit(`generate:${user.id}:${clientIp(request.headers)}`, 10, 60_000);
  if (!limit.ok) {
    return Response.json({ ok: false, error: "Too many requests. Please wait a minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = generateInputSchema.safeParse(body);
  if (!parsed.success) return badRequest("Check the subject and days option.");

  const outcome = await generatePage({
    subjectId: parsed.data.subjectId,
    daysOption: parsed.data.daysOption,
    note: parsed.data.note,
    userId: user.id,
  });

  switch (outcome.status) {
    case "created":
      return Response.json({ ok: true, status: "created", pageId: outcome.pageId }, { status: 201 });
    case "existing":
      return Response.json({ ok: true, status: "existing", pageId: outcome.pageId });
    case "locked":
      return Response.json({ ok: true, status: "locked", message: outcome.message }, { status: 202 });
    case "limit":
      return Response.json(
        { ok: false, code: "LIMIT", error: outcome.message, used: outcome.used, limit: outcome.limit },
        { status: 429 },
      );
    case "cap":
      return Response.json({ ok: false, code: "CAP", error: outcome.message }, { status: 503 });
    default:
      return Response.json(
        { ok: false, code: outcome.code, error: outcome.message },
        { status: outcome.code === "NO_SUBJECT" ? 404 : 502 },
      );
  }
}
