"use client";

// Design Ref: DESIGN.md §1.2 ② — 파일별 결과 영역: 파일, 기관, 항목 종류, 상태, 추출한 값(보기).
// Plan SC: PLAN.md 11번 — 추출한 항목·값 표 보기, 중복 파일 중 사용할 파일 고르기, 점검 실패 파일 다시 시도.
import type { ResultRow } from "@/lib/result-view";

interface Props {
  rows: readonly ResultRow[];
  onChoose: (row: ResultRow) => void;
  onRetry: (row: ResultRow) => void;
  /** 다시 시도 중인 파일 번호들 (버튼을 잠근다) */
  retryingIds: ReadonlySet<number>;
}

function badgeClass(state: ResultRow["state"]): string {
  switch (state) {
    case "unreadable":
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
    case "duplicate":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    case "ready":
    case "unclassified":
      return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export default function FileResultTable({ rows, onChoose, onRetry, retryingIds }: Props) {
  const duplicates = rows.filter((r) => r.canChoose).length;

  return (
    <section aria-labelledby="result-title" className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 id="result-title" className="text-lg font-semibold">
        파일별 결과
      </h2>
      {duplicates > 0 && (
        <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          같은 기관·같은 항목의 파일이 2개 이상입니다. 사용할 파일을 고르기 전에는 그 기관·항목을 순위에서 뺍니다.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-3 font-medium">파일</th>
              <th className="py-2 pr-3 font-medium">기관</th>
              <th className="py-2 pr-3 font-medium">항목 종류</th>
              <th className="py-2 pr-3 font-medium">상태</th>
              <th className="py-2 font-medium">추출한 값</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-100 align-top dark:border-zinc-900">
                <td className="max-w-[14rem] break-all py-2 pr-3">{row.fileName}</td>
                <td className="py-2 pr-3">{row.institution}</td>
                <td className="py-2 pr-3">{row.itemType}</td>
                <td className="py-2 pr-3">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${badgeClass(row.state)}`}>
                    {retryingIds.has(row.id) ? "점검 중" : row.stateLabel}
                  </span>
                  {row.note && <p className="mt-1 max-w-[16rem] text-xs text-zinc-600 dark:text-zinc-400">{row.note}</p>}
                  {row.canChoose && (
                    <button
                      type="button"
                      onClick={() => onChoose(row)}
                      className="mt-1 block text-xs font-medium text-blue-700 underline dark:text-blue-300"
                    >
                      이 파일 사용
                    </button>
                  )}
                  {row.canRetry && (
                    <button
                      type="button"
                      onClick={() => onRetry(row)}
                      disabled={retryingIds.has(row.id)}
                      className="mt-1 block text-xs font-medium text-blue-700 underline disabled:opacity-40 dark:text-blue-300"
                    >
                      다시 시도
                    </button>
                  )}
                </td>
                <td className="min-w-[14rem] py-2">
                  {row.extracted.length > 0 ? (
                    <details>
                      <summary className="cursor-pointer text-xs font-medium text-blue-700 dark:text-blue-300">
                        보기 ({row.extracted.length}개)
                      </summary>
                      <table className="mt-2 w-full border-collapse text-xs">
                        <thead>
                          <tr className="text-zinc-500">
                            <th className="py-1 pr-2 text-left font-medium">항목</th>
                            <th className="py-1 pr-2 text-left font-medium">값</th>
                            <th className="py-1 text-left font-medium">위치</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.extracted.map((f, i) => (
                            <tr key={i} className="border-t border-zinc-100 dark:border-zinc-900">
                              <td className="py-1 pr-2 whitespace-nowrap">{f.label}</td>
                              <td className={`py-1 pr-2 whitespace-nowrap ${f.value === "추출 불가" ? "text-zinc-400" : ""}`}>{f.value}</td>
                              <td className="py-1 whitespace-nowrap text-zinc-500">{f.location}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  ) : (
                    <span className="text-xs text-zinc-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
