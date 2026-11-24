import { ImportPanel } from "@/components/admin/ImportPanel";
import { all } from "@/lib/db";
import { verifySubject } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subjects · Admin" };

export default async function AdminSubjects() {
  const subjects = await all<{
    id: number;
    code: string;
    name: string;
    semester: number;
    scheme: string;
    is_common: number;
    is_sample: number;
    verified: number;
    branches: string | null;
    units: number;
    questions: number;
  }>(
    `SELECT s.id, s.code, s.name, s.semester, s.scheme, s.is_common, s.is_sample, s.verified,
            (SELECT GROUP_CONCAT(b.short_code, ', ') FROM subject_branches sb
             JOIN branches b ON b.id = sb.branch_id WHERE sb.subject_id = s.id) AS branches,
            (SELECT COUNT(*) FROM syllabus_units u WHERE u.subject_id = s.id) AS units,
            (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id) AS questions
     FROM subjects s ORDER BY s.semester, s.code`,
  );

  return (
    <div className="space-y-4">
      <ImportPanel />

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Sem</th>
              <th className="px-3 py-2">Scheme</th>
              <th className="px-3 py-2">Units</th>
              <th className="px-3 py-2">Q</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {subjects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-stone-500">
                  No subjects yet. Paste the subjects CSV above.
                </td>
              </tr>
            ) : null}
            {subjects.map((subject) => (
              <tr key={subject.id}>
                <td className="px-3 py-2">
                  <p className="font-semibold">{subject.name}</p>
                  <p className="text-xs text-stone-500">
                    {subject.code} · {subject.branches ?? "no branches"}
                    {subject.is_sample ? " · sample" : ""}
                  </p>
                </td>
                <td className="px-3 py-2">{subject.semester}</td>
                <td className="px-3 py-2 text-xs">{subject.scheme}</td>
                <td className="px-3 py-2">{subject.units}</td>
                <td className="px-3 py-2">{subject.questions}</td>
                <td className="px-3 py-2">
                  <span
                    className={`chip ${subject.verified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-stone-50 text-stone-600"}`}
                  >
                    {subject.verified ? "Verified" : "Unverified"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <form action={verifySubject}>
                    <input type="hidden" name="id" value={subject.id} />
                    <input type="hidden" name="verified" value={subject.verified ? "0" : "1"} />
                    <button type="submit" className="text-xs font-semibold text-indigo-600 hover:underline">
                      {subject.verified ? "Unverify" : "Verify"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
