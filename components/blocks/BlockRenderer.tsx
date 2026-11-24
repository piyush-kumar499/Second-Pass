import type { Block } from "@/lib/schema/page";
import { FormulaBlock } from "./FormulaBlock";
import { MermaidDiagram } from "./MermaidDiagram";

const noteStyles: Record<string, string> = {
  tip: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-rose-200 bg-rose-50 text-rose-900",
  exam_hint: "border-amber-200 bg-amber-50 text-amber-900",
};

const noteLabels: Record<string, string> = {
  tip: "Tip",
  warning: "Careful",
  exam_hint: "Exam hint",
};

export function BlockList({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <BlockRenderer key={index} block={block} />
      ))}
    </div>
  );
}

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const className =
        block.level === 2
          ? "font-serif text-xl font-bold"
          : block.level === 4
            ? "font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500"
            : "font-serif text-base font-bold";
      return <p className={`mt-3 ${className}`}>{block.text}</p>;
    }
    case "paragraph":
      return <p className="whitespace-pre-line text-[0.95rem] leading-[1.75] text-ink/90">{block.text}</p>;
    case "bullets":
      return (
        <ul className="space-y-1.5 text-[0.95rem] leading-[1.7] text-ink/90">
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-2.5">
              <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1px] bg-pine-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "qa":
      return (
        <article className="print-block rounded-md border border-line border-l-2 border-l-pine-300 bg-card p-3">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-[0.95rem] font-semibold leading-snug">Q. {block.question}</p>
            <span className="flex shrink-0 gap-1">
              {block.marks ? (
                <span className="chip border-indigo-200 bg-indigo-50 text-indigo-700">
                  {block.marks} marks
                </span>
              ) : null}
              {block.year ? (
                <span className="chip border-stone-200 bg-stone-50 text-stone-600">{block.year}</span>
              ) : null}
            </span>
          </header>
          <div className="mt-2 border-t border-dashed border-line pt-2">
            <p className="mb-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-stone-400">
              Model answer
            </p>
            <BlockList blocks={block.answer_blocks as Block[]} />
          </div>
        </article>
      );
    case "numerical":
      return (
        <article className="print-block rounded-md border border-line border-l-2 border-l-pine-300 bg-card p-3">
          <p className="text-[0.95rem] font-semibold">Practice numerical</p>
          <p className="mt-1 text-[0.95rem] leading-relaxed">{block.problem}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.9rem] leading-relaxed">
            {block.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
            Answer: {block.final_answer}
          </p>
        </article>
      );
    case "formula":
      return <FormulaBlock latex={block.latex} caption={block.caption} />;
    case "mermaid":
      return <MermaidDiagram code={block.code} caption={block.caption} />;
    case "table":
      return (
        <div className="print-block my-2 overflow-x-auto rounded-md border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-deep/70 font-mono text-[10px] uppercase tracking-wider text-stone-500">
              <tr>
                {block.headers.map((header, index) => (
                  <th key={index} className="px-3 py-2 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note":
      return (
        <div className={`print-block rounded-md border p-3 text-sm leading-relaxed ${noteStyles[block.kind]}`}>
          <p className="mb-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] opacity-70">
            {noteLabels[block.kind]}
          </p>
          {block.text}
        </div>
      );
    default:
      return null;
  }
}
