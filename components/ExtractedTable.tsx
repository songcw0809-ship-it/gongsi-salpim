// 추출한 항목·값을 알리오 보고서처럼 묶음별 표로 보인다 (lib/extracted-view.ts).
// 읽기 쉽도록: 열 제목 강조, 예산 열 구분, 줄무늬·세로 구분선, 합계 줄 강조, 0은 흐리게, 긴 주석은 따로 상자로.
import YearChartView from "@/components/YearChart";
import { buildYearChart } from "@/lib/chart-data";
import { buildExtractedSections } from "@/lib/extracted-view";
import type { ExtractedRow, ExtractedSection } from "@/lib/extracted-view";
import type { ExtractedField } from "@/lib/types";

const isBudget = (column: string) => column.includes("예산");
const isEmptyValue = (v: string) => v === "추출 불가" || v === "-" || v === "·";
const isZero = (v: string) => /^-?0(\.0+)?$/.test(v);

function valueClass(v: string, budget: boolean, numeric: boolean): string {
  const tone = isEmptyValue(v) ? "text-zinc-400" : isZero(v) ? "text-zinc-400" : "";
  const align = numeric ? "text-right tabular-nums" : "";
  const tint = budget ? "bg-amber-50/70 dark:bg-amber-950/20" : "";
  return `border-l border-zinc-100 px-4 py-2.5 dark:border-zinc-800 ${align} ${tone} ${tint}`;
}

function RowView({ row, section }: { row: ExtractedRow; section: ExtractedSection }) {
  const cols = section.columns;
  if (row.kind === "note") {
    return (
      <tr className="border-t border-zinc-200 dark:border-zinc-800">
        <td colSpan={cols.length + 1} className="bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="font-semibold">※ {row.label}</span>
          <span className="ml-2">{row.cells[0].replace(/^\*\s*/, "")}</span>
        </td>
      </tr>
    );
  }
  const total = row.kind === "total";
  const sub = row.kind === "sub";
  const rowClass = total
    ? "border-t-2 border-zinc-300 bg-amber-50 font-semibold dark:border-zinc-600"
    : "border-t border-zinc-100 odd:bg-white even:bg-zinc-50/70 hover:bg-amber-50/70 dark:border-zinc-800 dark:odd:bg-transparent dark:even:bg-zinc-900/40 dark:hover:bg-blue-950/20";
  const labelBg = total ? "bg-amber-50" : "bg-inherit";
  return (
    <tr className={rowClass}>
      <th
        scope="row"
        title={row.location}
        className={`sticky left-0 z-[1] min-w-[9rem] px-4 py-2.5 text-left whitespace-nowrap ${labelBg} ${
          sub ? "pl-8 font-normal text-zinc-500" : total ? "font-semibold" : "font-medium text-zinc-800 dark:text-zinc-200"
        }`}
      >
        {sub && <span aria-hidden className="mr-1 text-zinc-300">└</span>}
        {row.label}
      </th>
      {row.merged ? (
        <td colSpan={Math.max(cols.length, 1)} className={valueClass(row.cells[0], false, false)}>
          {row.cells[0]}
        </td>
      ) : (
        row.cells.map((c, k) => (
          <td key={k} className={valueClass(c, cols[k] ? isBudget(cols[k]) : false, cols.length > 0)}>
            {c}
          </td>
        ))
      )}
    </tr>
  );
}

export default function ExtractedTable({ fields }: { fields: readonly ExtractedField[] }) {
  const sections = buildExtractedSections(fields);
  return (
    <div className="flex flex-col gap-6">
      {sections.map((s) => (
        <section key={s.title} className="overflow-hidden rounded-lg border border-zinc-200 shadow-sm dark:border-zinc-800">
          <header className="flex items-center gap-2.5 border-b border-zinc-100 bg-[#fffdf6] px-4 py-3">
            <span aria-hidden className="inline-block h-5 w-1.5 rounded-full bg-[var(--sun)]" />
            <h3 className="text-base font-bold">{s.title}</h3>
            {s.caption && <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{s.caption}</span>}
          </header>
          {(() => {
            const chart = buildYearChart(s);
            return chart ? (
              <div className="px-3 pt-1">
                <YearChartView chart={chart} title={s.title} />
              </div>
            ) : null;
          })()}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              {s.columns.length > 0 && (
                <thead>
                  <tr className="bg-zinc-100 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    <th scope="col" className="sticky left-0 z-[1] bg-zinc-100 px-4 py-2.5 text-left font-semibold dark:bg-zinc-800">
                      항목
                    </th>
                    {s.columns.map((c) => (
                      <th
                        key={c}
                        scope="col"
                        className={`border-l border-zinc-200 px-4 py-2.5 text-right font-semibold whitespace-nowrap dark:border-zinc-700 ${
                          isBudget(c) ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" : ""
                        }`}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {s.rows.map((r, i) => (
                  <RowView key={i} row={r} section={s} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
