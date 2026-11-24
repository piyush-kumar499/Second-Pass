import { adminOrError } from "@/lib/admin-guard";
import { importSubjects, importUnits, parseSubjectCsv, parseUnitCsv } from "@/lib/import";

export const dynamic = "force-dynamic";

// Preview never writes to the database.
export async function POST(request: Request) {
  const guard = await adminOrError();
  if ("response" in guard) return guard.response;

  let body: { type?: string; csv?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const csv = String(body.csv ?? "").slice(0, 1_000_000);
  if (!csv.trim()) return Response.json({ ok: false, error: "Paste some CSV first." }, { status: 400 });

  if (body.type === "subjects") {
    const parsed = parseSubjectCsv(csv);
    return Response.json({ ok: true, rows: parsed.rows, errors: parsed.errors });
  }
  if (body.type === "units") {
    const parsed = parseUnitCsv(csv);
    return Response.json({ ok: true, rows: parsed.rows, errors: parsed.errors });
  }
  return Response.json({ ok: false, error: "Unknown import type." }, { status: 400 });
}

// Commit re-parses the same CSV, so the client cannot inject unchecked rows.
export async function PUT(request: Request) {
  const guard = await adminOrError();
  if ("response" in guard) return guard.response;

  let body: { type?: string; csv?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const csv = String(body.csv ?? "").slice(0, 1_000_000);
  if (!csv.trim()) return Response.json({ ok: false, error: "Paste some CSV first." }, { status: 400 });

  if (body.type === "subjects") {
    const parsed = parseSubjectCsv(csv);
    if (parsed.rows.length === 0) {
      return Response.json({ ok: false, error: parsed.errors[0] ?? "No usable rows.", errors: parsed.errors });
    }
    const summary = await importSubjects(parsed.rows);
    return Response.json({
      ok: true,
      summary: {
        saved: summary.saved,
        skipped: summary.skipped,
        errors: [...parsed.errors, ...summary.errors],
      },
    });
  }
  if (body.type === "units") {
    const parsed = parseUnitCsv(csv);
    if (parsed.rows.length === 0) {
      return Response.json({ ok: false, error: parsed.errors[0] ?? "No usable rows.", errors: parsed.errors });
    }
    const summary = await importUnits(parsed.rows);
    return Response.json({
      ok: true,
      summary: {
        saved: summary.saved,
        skipped: summary.skipped,
        errors: [...parsed.errors, ...summary.errors],
      },
    });
  }
  return Response.json({ ok: false, error: "Unknown import type." }, { status: 400 });
}
