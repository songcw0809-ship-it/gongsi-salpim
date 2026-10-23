// 기관별 의심 항목 수를 신뢰도별로 나눈 가로 막대그래프 (기관별 요약 위). 순위가 있는 기관만 그린다.
import { buildFindingBars } from "@/lib/chart-data";
import type { Summary } from "@/lib/types";

const LEVELS = [
  { key: "high", label: "신뢰도 높음", color: "#ef4444" },
  { key: "mid", label: "중간", color: "#f97316" },
  { key: "low", label: "낮음", color: "#22b8f0" },
] as const;

export default function FindingsChart({ summary }: { summary: Summary }) {
  const bars = buildFindingBars(summary.institutions);
  if (bars.length === 0 || bars.every((b) => b.total === 0)) return null;
  return (
    <figure className="chart-card">
      <figcaption className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-[var(--ink)]">
        기관별 의심 항목 수
        <span className="flex flex-wrap gap-x-3 text-xs font-medium text-[var(--muted)]">
          {LEVELS.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </span>
      </figcaption>
      <ul className="flex flex-col gap-2.5">
        {bars.map((b) => (
          <li key={b.institution} className="grid grid-cols-[minmax(6rem,11rem)_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="truncate font-medium text-[var(--ink)]" title={b.institution}>
              {b.institution}
            </span>
            <span className="flex h-3 overflow-hidden rounded-full bg-[#eef1f6]" role="img" aria-label={`${b.institution} 의심 항목 ${b.total}건 (높음 ${b.high}, 중간 ${b.mid}, 낮음 ${b.low})`}>
              <span className="flex h-full" style={{ width: `${b.percent}%` }}>
                {[b.high, b.mid, b.low].map((v, i) =>
                  v > 0 ? <span key={i} style={{ flex: v, background: LEVELS[i].color }} className="h-full" /> : null,
                )}
              </span>
            </span>
            <span className="text-right text-xs font-bold tabular-nums text-[var(--ink)]">{b.total}건</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
