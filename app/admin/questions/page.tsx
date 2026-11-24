import Link from "next/link";
import { all } from "@/lib/db";
import { deleteQuestion, setQuestionVerified, toggleQuestionFlag } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Questions · Admin" };

export default async function AdminQuestions({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; flagged?: string }>;
}) {
  const params = await searchParams;
  const subjectId = Number(params.subject ?? 0);
  const flaggedOnly = params.flagged === "1";

  const subjects = await all<{ id: number; code: string; name: string; questions: number }>(
    `SELECT s.id, s.code, s.name,
            (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id) AS questions
     FROM subjects s ORDER BY s.semester, s.code`,
  );

  const clauses: string[] = [];
  const args: (number | string)[] = [];
  if (subjectId) {
    clauses.push("q.subject_id = ?");
    args.push(subjectId);
  }
  if (flaggedOnly) clauses.push("q.flagged = 1");
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  args.push(200);

  const questions = await all<{
    id: number;
    text: string;
    marks: number | null;
    unit_no: number | null;
    year: number | null;
    session: string | null;
    verified: number;
    flagged: number;
    flag_reason: string | null;
    code: string;
    name: string;
  }>(
    `SELECT q.id, q.text, q.marks, q.unit_no, q.year, q.session, q.verified, q.flagged,
            q.flag_reason, s.code, s.name
     FROM questions q JOIN subjects s ON s.id = q.subject_id
     ${where}
     ORDER BY q.flagged DESC, q.unit_no, q.year DESC, q.id DESC LIMIT ?`,
    args,
  );

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2" action="/admin/questions">
        <label className="block">
          <span className="label">Subject</span>
          <select name="subject" defaultValue={String(subjectId)} className="input !w-auto">
            <option value="0">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} · {subject.name} ({subject.questions})
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 pb-2 text-xs text-stone-600">
          <input type="checkbox" name="flagged" value="1" defaultChecked={flaggedOnly} />
          Flagged only
        </label>
        <button type="submit" className="btn-ghost !py-2">
          Filter
        </button>
        <span className="ml-auto self-center text-xs text-stone-500">
          {questions.length} shown (max 200)
        </span>
      </form>

      <ul className="space-y-2">
        {questions.length === 0 ? (
          <li className="card p-4 text-sm text-stone-600">No questions match.</li>
        ) : null}
        {questions.map((question) => (
          <li key={question.id} className={`card p-3 ${question.flagged ? "border-amber-300" : ""}`}>
            <div className="flex flex-wrap items-center gap-1.5 text-[0.65rem]">
              <span className="chip border-stone-200 bg-stone-50 text-stone-600">{question.code}</span>
              {question.unit_no ? (
                <span className="chip border-indigo-200 bg-indigo-50 text-indigo-700">Unit {question.unit_no}</span>
              ) : (
                <span className="chip border-stone-200 bg-white text-stone-500">Old syllabus / no unit</span>
              )}
              {question.marks ? (
                <span className="chip border-stone-200 bg-white text-stone-600">{question.marks} marks</span>
              ) : null}
              {question.year ? (
                <span className="chip border-stone-200 bg-white text-stone-600">{question.year}</span>
              ) : null}
              {question.verified ? (
                <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">Verified</span>
              ) : null}
              {question.flagged ? (
                <span className="chip border-amber-200 bg-amber-50 text-amber-800">Flagged</span>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed">{question.text}</p>
            {question.flag_reason ? (
              <p className="mt-1 text-xs text-amber-700">{question.flag_reason}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <form action={setQuestionVerified}>
                <input type="hidden" name="id" value={question.id} />
                <input type="hidden" name="verified" value={question.verified ? "0" : "1"} />
                <button type="submit" className="font-semibold text-indigo-600 hover:underline">
                  {question.verified ? "Unverify" : "Verify"}
                </button>
              </form>
              <form action={toggleQuestionFlag}>
                <input type="hidden" name="id" value={question.id} />
                <button type="submit" className="font-semibold text-amber-700 hover:underline">
                  {question.flagged ? "Clear flag" : "Flag"}
                </button>
              </form>
              <form action={deleteQuestion}>
                <input type="hidden" name="id" value={question.id} />
                <button type="submit" className="font-semibold text-rose-600 hover:underline">
                  Delete
                </button>
              </form>
              <Link href={`/admin/papers`} className="ml-auto text-stone-400">
                {question.session ?? ""}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
