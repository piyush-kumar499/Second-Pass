"use client";

import { useEffect, useRef } from "react";
import katex from "katex";

// KaTeX renders into a real DOM node, so AI text never goes through dangerouslySetInnerHTML.
export function FormulaBlock({ latex, caption }: { latex: string; caption?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.textContent = "";
    try {
      katex.render(latex, node, { displayMode: true, throwOnError: false, strict: false });
    } catch {
      node.textContent = latex;
    }
  }, [latex]);

  return (
    <figure className="print-block my-3 overflow-x-auto rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
      <span ref={ref} className="block text-[0.95rem]" />
      {caption ? <figcaption className="mt-1 text-xs text-stone-500">{caption}</figcaption> : null}
    </figure>
  );
}
