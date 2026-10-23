// 연도별 값을 막대그래프로 보인다 (lib/chart-data.ts). 표의 숫자를 그림으로 옮긴 것이며 값은 표와 같다.
// 결산 연도는 진한 막대, 예산 연도는 줄무늬(아직 확정되지 않은 값) 막대로 구분한다.
import type { YearChart } from "@/lib/chart-data";

/** 항목 색 (파란색은 쓰지 않고 따뜻한 색 위주) */
const COLORS = ["#1f7a6d", "#f2a65a", "#e07a5f", "#9bbf8a", "#b79b86", "#c9bfd1"];

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default function YearChartView({ chart, title }: { chart: YearChart; title: string }) {
  const W = 640;
  const H = 220;
  const padL = 8;
  const padR = 8;
  const padT = 26;
  const padB = 44;
  const n = chart.years.length;
  const slot = (W - padL - padR) / n;
  const stacked = chart.mode === "stacked";
  const k = chart.series.length;

  const stackTotals = stacked ? (chart.totals as number[]) : [];
  const maxVal = Math.max(
    1,
    ...(stacked
      ? stackTotals.map((t, i) => Math.max(t, chart.series.reduce((s, r) => s + (r.values[i] ?? 0), 0)))
      : chart.series.flatMap((r) => r.values.map((v) => v ?? 0))),
  );
  const innerH = H - padT - padB;
  const y = (v: number) => padT + innerH - (v / maxVal) * innerH;
  const barW = Math.min(64, slot * 0.58);

  return (
    <figure className="mb-1 mt-3 rounded-2xl bg-[#fff8e6]/60 p-4">
      <figcaption className="mb-1 flex flex-wrap items-baseline gap-2 text-sm font-bold text-[var(--ink)]">
        {title} · 연도별 {stacked ? "구성과 합계" : "비교"}
        {chart.unit && <span className="text-xs font-medium text-[var(--muted)]">단위: {chart.unit}</span>}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} 연도별 그래프`} className="h-auto w-full">
        <defs>
          <pattern id="budget-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="6" fill="rgba(255,255,255,0.5)" />
          </pattern>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={padL} x2={W - padR} y1={y(maxVal * g)} y2={y(maxVal * g)} stroke="#eadfc8" strokeDasharray="2 5" />
        ))}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="#d9cdb2" />
        {chart.years.map((year, i) => {
          const cx = padL + slot * i + slot / 2;
          const label = year.replace(/\s*(결산|예산)\s*$/, "");
          const kind = chart.budget[i] ? "예산" : "결산";
          let acc = 0;
          return (
            <g key={year}>
              {stacked ? (
                <>
                  <clipPath id={`bar-${i}`}>
                    <rect x={cx - barW / 2} y={y(chart.series.reduce((s, r) => s + Math.max(r.values[i] ?? 0, 0), 0))} width={barW} height={Math.max(y(0) - y(chart.series.reduce((s, r) => s + Math.max(r.values[i] ?? 0, 0), 0)), 0)} rx={9} />
                  </clipPath>
                  <g clipPath={`url(#bar-${i})`}>
                    {chart.series.map((s, si) => {
                      const v = s.values[i] ?? 0;
                      if (v <= 0) return null;
                      const top = y(acc + v);
                      const h = y(acc) - top;
                      acc += v;
                      return (
                        <g key={s.label}>
                          <rect x={cx - barW / 2} y={top} width={barW} height={Math.max(h, 0)} fill={COLORS[si % COLORS.length]} stroke="#fffaf0" strokeWidth={1.5} />
                          {chart.budget[i] && <rect x={cx - barW / 2} y={top} width={barW} height={Math.max(h, 0)} fill="url(#budget-stripe)" />}
                        </g>
                      );
                    })}
                  </g>
                  <text x={cx} y={y(Math.max(stackTotals[i], acc)) - 7} textAnchor="middle" fontSize="12" fontWeight="800" fill="#134e44">
                    {fmt(stackTotals[i])}
                  </text>
                </>
              ) : (
                chart.series.map((s, si) => {
                  const v = s.values[i];
                  if (v === null || v === undefined) return null;
                  const w = barW / k;
                  const x = cx - barW / 2 + si * w;
                  return (
                    <g key={s.label}>
                      <rect x={x + 1} y={y(v)} width={Math.max(w - 2, 2)} height={Math.max(y(0) - y(v), 0)} fill={COLORS[si % COLORS.length]} rx={4} />
                      {chart.budget[i] && <rect x={x + 1} y={y(v)} width={Math.max(w - 2, 2)} height={Math.max(y(0) - y(v), 0)} fill="url(#budget-stripe)" />}
                      {k <= 2 && (
                        <text x={x + w / 2} y={y(v) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a">
                          {fmt(v)}
                        </text>
                      )}
                    </g>
                  );
                })
              )}
              <text x={cx} y={H - 24} textAnchor="middle" fontSize="12" fontWeight="700" fill="#334155">
                {label}
              </text>
              <text x={cx} y={H - 9} textAnchor="middle" fontSize="11" fill={chart.budget[i] ? "#c2410c" : "#64748b"} fontWeight={chart.budget[i] ? 700 : 500}>
                {kind}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        {chart.series.map((s, si) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[si % COLORS.length] }} />
            {s.label}
          </li>
        ))}
        {chart.budget.some(Boolean) && <li className="text-[#c2410c]">줄무늬 = 예산(확정 전)</li>}
      </ul>
      {chart.mismatch && <p className="mt-1 text-xs text-[var(--muted)]">※ 쌓은 항목의 합이 표의 합계와 다를 수 있어 합계는 표의 값을 그대로 적었습니다.</p>}
    </figure>
  );
}
