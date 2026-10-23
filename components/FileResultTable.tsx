"use client";

// Design Ref: DESIGN.md §1.2 ② — 파일별 결과 영역: 파일, 기관, 항목 종류, 상태, 추출한 값(보기).
// Plan SC: PLAN.md 11번 — 추출한 항목·값 표 보기, 중복 파일 중 사용할 파일 고르기, 점검 실패 파일 다시 시도.
import ExtractedTable from "@/components/ExtractedTable";
import { countStatuses } from "@/lib/chart-data";
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
    case "unchecked":
      return "bg-amber-100 text-amber-900";
    case "duplicate":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    case "ready":
    case "unclassified":
      return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

const STATUS_COLOR = {
  done: "#1f7a6d",
  "waiting-criteria": "#f2a65a",
  none: "#cbd5e1",
  problem: "#e07a5f",
  progress: "#0f172a",
} as const;

/** 점검 결과 상태를 한 줄 막대로 요약한다 */
function StatusBar({ states }: { states: readonly string[] }) {
  const parts = countStatuses(states);
  const total = states.length;
  return (
    <div className="rounded-2xl bg-[#fff8e6]/60 p-4">
      <p className="mb-2 text-sm font-bold text-[var(--ink)]">
        점검 현황 <span className="font-medium text-[var(--muted)]">· 전체 {total}건</span>
      </p>
      <div className="flex h-4 overflow-hidden rounded-full bg-white/80" role="img" aria-label={parts.map((p) => `${p.label} ${p.count}건`).join(", ")}>
        {parts.map((p) => (
          <span key={p.key} style={{ flex: p.count, background: STATUS_COLOR[p.key] }} className="h-full" />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLOR[p.key] }} />
            {p.label} <b className="text-[var(--ink)]">{p.count}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FileResultTable({ rows, onChoose, onRetry, retryingIds }: Props) {
  const duplicates = rows.filter((r) => r.canChoose).length;
  const masked = rows.reduce((sum, r) => sum + r.maskedCount, 0);

  return (
    <section aria-labelledby="result-title" className="flex flex-col gap-3 card">
      <h2 id="result-title" className="card-title">
        파일별 결과
      </h2>
      {rows.length > 1 && <StatusBar states={rows.map((r) => r.state)} />}
      {masked > 0 && (
        <p role="status" className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          개인정보로 보이는 값(전화번호·이메일·주민등록번호 형태) {masked}개를 가려서 보여 줍니다.
        </p>
      )}
      {duplicates > 0 && (
        <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          같은 기관·같은 항목의 파일이 2개 이상입니다. 사용할 파일을 고르기 전에는 그 기관·항목을 순위에서 뺍니다.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-3 font-medium">파일 · 보고서</th>
              <th className="py-2 pr-3 font-medium">기관</th>
              <th className="py-2 pr-3 font-medium">항목 종류</th>
              <th className="py-2 pr-3 font-medium">상태</th>
              <th className="py-2 font-medium">추출한 값</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-100 align-top dark:border-zinc-900">
                <td className="max-w-[14rem] break-all py-2 pr-3">
                  {row.fileName}
                  {row.alioLinks && (row.alioLinks.itemUrl || row.alioLinks.pdfUrl) && (
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-medium">
                      {row.alioLinks.itemUrl && (
                        <a href={row.alioLinks.itemUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--ink)] underline">
                          알리오 항목 화면 ↗
                        </a>
                      )}
                      {row.alioLinks.pdfUrl && (
                        <a href={row.alioLinks.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--ink)] underline">
                          보고서 PDF 받기 ↗
                        </a>
                      )}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3">{row.institution}</td>
                <td className="py-2 pr-3">{row.itemType}</td>
                <td className="py-2 pr-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass(row.state)}`}>
                    {retryingIds.has(row.id) ? "점검 중" : row.stateLabel}
                  </span>
                  {row.note && <p className="mt-1 max-w-[16rem] text-xs text-zinc-600 dark:text-zinc-400">{row.note}</p>}
                  {row.canChoose && (
                    <button
                      type="button"
                      onClick={() => onChoose(row)}
                      className="mt-1 block text-xs font-medium text-[var(--ink)] underline"
                    >
                      이 파일 사용
                    </button>
                  )}
                  {row.canRetry && (
                    <button
                      type="button"
                      onClick={() => onRetry(row)}
                      disabled={retryingIds.has(row.id)}
                      className="mt-1 block text-xs font-medium text-[var(--ink)] underline disabled:opacity-40"
                    >
                      다시 시도
                    </button>
                  )}
                </td>
                <td className="min-w-[8rem] py-2">
                  {row.extracted.length > 0 ? (
                    <a href={`#extracted-${row.id}`} className="text-xs font-medium text-[var(--ink)]">
                      {row.extracted.length}개 (아래 표)
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows
        .filter((r) => r.extracted.length > 0)
        .map((row) => (
          <details key={row.id} id={`extracted-${row.id}`} open={rows.length === 1} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <summary className="cursor-pointer text-sm font-medium">
              {row.fileName} · 추출한 값 ({row.extracted.length}개)
            </summary>
            <div className="mt-3">
              <ExtractedTable fields={row.extracted} />
            </div>
          </details>
        ))}
    </section>
  );
}
