import { getPage, reportPage } from "@/lib/pages";
import { currentUser } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { badRequest, reportInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = rateLimit(`report:${clientIp(request.headers)}`, 5, 60 * 60_000);
  if (!limit.ok) {
    return Response.json({ ok: false, error: "Too many reports. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = reportInputSchema.safeParse(body);
  if (!parsed.success) return badRequest("Please add a short reason (3 to 500 characters).");

  const page = await getPage(parsed.data.pageId);
  if (!page) return badRequest("Page not found.", 404);

  const user = await currentUser();
  const result = await reportPage({
    pageId: parsed.data.pageId,
    userId: user?.id ?? null,
    reason: parsed.data.reason,
  });

  return Response.json({ ok: true, reports: result.reports, hidden: result.hidden });
}
