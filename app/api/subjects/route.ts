import { listSubjects } from "@/lib/subjects";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { searchQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = rateLimit(`search:${clientIp(request.headers)}`, 60, 60_000);
  if (!limit.ok) {
    return Response.json(
      { ok: false, error: "Too many searches. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const url = new URL(request.url);
  const parsed = searchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    branch: url.searchParams.get("branch") ?? undefined,
    semester: url.searchParams.get("semester") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Invalid search." }, { status: 400 });
  }

  const subjects = await listSubjects({
    q: parsed.data.q,
    branchId: parsed.data.branch,
    semester: parsed.data.semester,
    limit: 20,
  });

  return Response.json({
    ok: true,
    subjects: subjects.map((subject) => ({
      id: subject.id,
      code: subject.code,
      name: subject.name,
      semester: subject.semester,
      scheme: subject.scheme,
      is_sample: Boolean(subject.is_sample),
    })),
  });
}
