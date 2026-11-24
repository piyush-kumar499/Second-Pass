import { IngestPanel } from "@/components/admin/IngestPanel";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add paper · Admin" };

export default async function AdminPapers() {
  const [subjects, papers] = await Promise.all([
    all<{ id: number; code: string; name: string; semester: number }>(
      "SELECT id, code, name, semester FROM subjects ORDER BY semester, code",
    ),
    all<{
      id: number;
      session: string;
      year: number | null;
      source_note: string | null;
      source_url: string | null;
      code: string;
      name: string;
      questions: number;
      verified: number;
    }>(
      `SELECT p.id, p.session, p.year, p.source_note, p.source_url, p.verified,
              s.code, s.name,
              (SELECT COUNT(*) FROM questions q WHERE q.paper_id = p.id) AS questions
       FROM papers p JOIN subjects s ON s.id = p.subject_id
       ORDER BY p.year DESC, p.session, s.code`,
    ),
  ]);

  return (
    <div className="space-y-4">
      <IngestPanel subjects={subjects} />

      <div className="card overflow-x-auto">
        <div className="border-b border-stone-200 px-3 py-2">
          <h2 className="text-sm font-bold">Imported papers</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Questions</th>
              <th className="px-3 py-2">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {papers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-stone-500">
                  No papers imported yet.
                </td>
              </tr>
            ) : null}
            {papers.map((paper) => (
              <tr key={paper.id}>
                <td className="px-3 py-2">
                  <p className="font-semibold">{paper.name}</p>
                  <p className="text-xs text-stone-500">{paper.code}</p>
                </td>
                <td className="px-3 py-2 text-xs">{paper.session}</td>
                <td className="px-3 py-2 text-xs">{paper.year ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{paper.questions}</td>
                <td className="max-w-[12rem] truncate px-3 py-2 text-xs text-stone-500">
                  {paper.source_url ? (
                    <a href={paper.source_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                      source
                    </a>
                  ) : (
                    paper.source_note ?? "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
