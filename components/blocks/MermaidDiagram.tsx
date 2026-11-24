"use client";

import { useEffect, useId, useRef, useState } from "react";

// Mermaid runs with securityLevel "strict". The SVG is parsed with DOMParser and
// appended as real nodes, so we never inject AI text as HTML.
export function MermaidDiagram({ code, caption }: { code: string; caption?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [failedCode, setFailedCode] = useState<string | null>(null);
  const failed = failedCode === code;
  const rawId = useId();
  const id = `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
        const { svg } = await mermaid.render(id, code);
        if (cancelled || !container.current) return;
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        container.current.replaceChildren(document.importNode(doc.documentElement, true));
      } catch {
        if (!cancelled) setFailedCode(code);
      }
    })();

    return () => {
      cancelled = true;
      // Mermaid leaves a measuring element behind on some errors.
      document.getElementById(`d${id}`)?.remove();
    };
  }, [code, id]);

  return (
    <figure className="print-block my-3 rounded-xl border border-stone-200 bg-white p-2">
      {failed ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-amber-700">
            This diagram could not be drawn. The code is shown instead.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-stone-50 p-2 text-xs text-stone-700">
            {code}
          </pre>
        </div>
      ) : (
        <div ref={container} className="overflow-x-auto text-center [&_svg]:mx-auto [&_svg]:max-w-full" />
      )}
      {caption ? <figcaption className="mt-1 text-xs text-stone-500">{caption}</figcaption> : null}
    </figure>
  );
}
