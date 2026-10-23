// 추출한 항목·값을 알리오 보고서처럼 묶음별 표로 보인다 (lib/extracted-view.ts).
import { buildExtractedSections } from "@/lib/extracted-view";
import type { ExtractedField } from "@/lib/types";

const MUTED = "text-zinc-400";

export default function ExtractedTable({ fields }: { fields: readonly ExtractedField[] }) {
  const sections = buildExtractedSections(fields);
  return (
    <div className="flex flex-col gap-4">
      {sections.map((s) => (
        <div key={s.title} className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-baseline gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">{s.title}</h3>
            {s.caption && <span className="text-xs text-zinc-500">({s.caption})</span>}
          </div>
          <table className="w-full border-collapse text-sm tabular-nums">
            {s.columns.length > 0 && (
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                  <th scope="col" className="px-3 py-1.5 text-left font-medium">
                    항목
                  </th>
                  {s.columns.map((c) => (
                    <th key={c} scope="col" className="px-3 py-1.5 text-right font-medium whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {s.rows.map((r, i) => (
                <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <th scope="row" title={r.location} className="px-3 py-1.5 text-left font-normal whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                    {r.label}
                  </th>
                  {r.merged ? (
                    <td colSpan={Math.max(s.columns.length, 1)} className={`px-3 py-1.5 ${r.cells[0] === "추출 불가" ? MUTED : ""}`}>
                      {r.cells[0]}
                    </td>
                  ) : (
                    r.cells.map((c, k) => (
                      <td key={k} className={`px-3 py-1.5 ${s.columns.length > 0 ? "text-right" : ""} ${c === "추출 불가" ? MUTED : ""}`}>
                        {c}
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
