import { currentVersion } from "@/lib/env";
import { findPage } from "@/lib/pages";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { statusQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// The client polls this while someone else is generating the same page.
export async function GET(request: Request) {
  const limit = rateLimit(`status:${clientIp(request.headers)}`, 120, 60_000);
  if (!limit.ok) {
    return Response.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }

  const url = new URL(request.url);
  const parsed = statusQuerySchema.safeParse({
    subjectId: url.searchParams.get("subjectId"),
    days: url.searchParams.get("days"),
  });
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid query." }, { status: 400 });

  const page = await findPage(parsed.data.subjectId, parsed.data.days, currentVersion());
  return Response.json({
    ok: true,
    exists: Boolean(page),
    pageId: page?.id ?? null,
    status: page?.status ?? null,
  });
}
