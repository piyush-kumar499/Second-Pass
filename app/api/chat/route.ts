import { askPageAI } from "@/lib/chat";
import { currentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { badRequest, chatInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ ok: false, code: "LOGIN_REQUIRED", error: "Please log in to chat." }, { status: 401 });
  }

  const limit = rateLimit(`chat:${user.id}`, 20, 60_000);
  if (!limit.ok) {
    return Response.json({ ok: false, error: "Slow down a little." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = chatInputSchema.safeParse(body);
  if (!parsed.success) return badRequest("Please write a shorter question.");

  const outcome = await askPageAI({
    userId: user.id,
    pageId: parsed.data.pageId,
    message: parsed.data.message,
  });

  if (outcome.ok) {
    return Response.json({ ok: true, reply: outcome.reply, messages: outcome.messages });
  }

  const status =
    outcome.code === "NO_PAGE" ? 404 : outcome.code === "LIMIT" || outcome.code === "CAP" ? 429 : 502;
  return Response.json({ ok: false, code: outcome.code, error: outcome.message }, { status });
}
