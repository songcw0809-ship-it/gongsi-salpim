// Design Ref: DESIGN.md §1.2 ③ — 기관별 요약 영역: 순위, 기관, 의심 항목, 신뢰도 높음, 업로드되지 않은 항목.
// Plan SC: PLAN.md 12번 — 확인 우선순위와 순위 기준 표시. 의심 항목이 없으면 "이상 없음"이라 쓰지 않는다 (PRD 5번 M2).
// 기관 이름을 누르면 상세 패널(PLAN 13번)이 열린다.
import FindingsChart from "@/components/FindingsChart";
import { maskText } from "@/lib/mask";
import { NO_FINDINGS_NOTE } from "@/lib/result-view";
import type { Summary } from "@/lib/types";

interface Props {
  summary: Summary;
  /** 파일 번호(문자열)를 화면에 보일 파일 이름으로 바꾼다 */
  nameOf: (fileKey: string) => string;
  /** 기관 이름을 누르면 상세 패널을 연다 */
  onSelect: (institution: string) => void;
  /** 알리오에서 가져왔지만 점검 기준이 없어 순위에 넣지 않은 건 수 */
  uncheckedCount?: number;
}

export default function InstitutionSummaryTable({ summary, nameOf, onSelect, uncheckedCount = 0 }: Props) {
  const { institutions, unassigned } = summary;
  if (institutions.length === 0 && unassigned.length === 0 && uncheckedCount === 0) return null;

  return (
    <section aria-labelledby="summary-title" className="flex flex-col gap-3 card">
      <h2 id="summary-title" className="card-title">
        기관별 요약
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-medium">순위 기준:</span> {summary.rankBasis}
      </p>
      <p className="text-xs text-zinc-500">기관 이름을 누르면 의심 항목의 근거를 볼 수 있습니다.</p>

      <FindingsChart summary={summary} />

      {institutions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-3 font-medium">순위</th>
                <th className="py-2 pr-3 font-medium">기관</th>
                <th className="py-2 pr-3 text-right font-medium">의심 항목</th>
                <th className="py-2 pr-3 text-right font-medium">신뢰도 높음</th>
                <th className="py-2 font-medium">안내</th>
              </tr>
            </thead>
            <tbody>
              {institutions.map((inst) => (
                <tr key={inst.institution} className="border-b border-zinc-100 align-top dark:border-zinc-900">
                  <td className="py-2 pr-3 font-semibold">{inst.rank ?? "-"}</td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => onSelect(inst.institution)}
                      className="text-left font-medium text-[var(--ink)] underline decoration-dotted underline-offset-2 dark:text-blue-300"
                    >
                      {inst.institution}
                    </button>
                  </td>
                  <td className="py-2 pr-3 text-right">{inst.rank === null ? "-" : inst.findingCount}</td>
                  <td className="py-2 pr-3 text-right">{inst.rank === null ? "-" : inst.highCount}</td>
                  <td className="py-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {inst.rank === null && <p className="font-medium text-amber-800 dark:text-amber-300">순위에서 제외됨</p>}
                    {inst.rank !== null && inst.findingCount === 0 && <p>{NO_FINDINGS_NOTE}</p>}
                    {inst.note && <p>{inst.note}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {institutions.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">순위에 넣을 수 있는 점검 결과가 아직 없습니다.</p>
      )}
      {uncheckedCount > 0 && (
        <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          점검 기준이 없는 항목 {uncheckedCount}건은 값만 뽑았고 순위에 넣지 않았습니다. 위 &ldquo;파일별 결과&rdquo;에서 추출한 값을 볼 수 있습니다.
        </p>
      )}
      {unassigned.length > 0 && (
        <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          기관 또는 항목 종류를 알 수 없어 순위에 넣지 못한 파일 {unassigned.length}개: {unassigned.map((key) => maskText(nameOf(key))).join(", ")}
        </p>
      )}
    </section>
  );
}
