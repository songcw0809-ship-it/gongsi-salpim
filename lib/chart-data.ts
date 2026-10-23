// 표(추출한 값)와 요약에서 그래프에 쓸 숫자를 뽑는다. 그래프는 이미 화면에 있는 값을 그림으로 보여 줄 뿐이며 새 값을 만들지 않는다.
// 이 파일은 일반 함수만 있어서 화면 없이 시험할 수 있다 (scripts/check_charts.mjs).
import type { ExtractedSection } from "./extracted-view.ts";

export interface ChartSeries {
  label: string;
  /** 연도마다 값. 값이 없는 칸("-" 등)은 null */
  values: (number | null)[];
}

export interface YearChart {
  /** "stacked": 항목을 쌓아 합계로 보임 / "grouped": 항목을 나란히 보임 */
  mode: "stacked" | "grouped";
  /** 열 제목. 예: "2021년 결산" */
  years: string[];
  /** 예산 열이면 true (그래프에서 다른 모양으로 그린다) */
  budget: boolean[];
  series: ChartSeries[];
  /** 합계 줄이 있으면 연도마다 합계 */
  totals: number[] | null;
  /** 표 설명에서 가져온 단위. 예: "천원" */
  unit: string | null;
  /** 쌓은 항목의 합이 합계 줄과 다를 때 true (그래프 밑에 알린다) */
  mismatch: boolean;
}

/** 숫자로 읽을 수 있으면 숫자, "-" 나 빈 칸은 null, 그 밖의 글자는 undefined(숫자 줄이 아님) */
export function parseNumber(cell: string): number | null | undefined {
  const t = cell.trim();
  if (t === "" || t === "-" || t === "·") return null;
  if (!/^-?\(?[\d,]+(\.\d+)?\)?$/.test(t)) return undefined;
  const n = Number(t.replace(/[,()]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

const MAX_SERIES = 6;

export function buildYearChart(section: ExtractedSection): YearChart | null {
  const years = section.columns;
  if (years.length < 2) return null;

  const numeric: { label: string; values: (number | null)[]; total: boolean; child: boolean }[] = [];
  let hasParent = false; // 앞에 "(…)"가 아닌 숫자 줄이 있으면 "(…)" 줄은 그 줄에 딸린 줄이다
  for (const row of section.rows) {
    if (row.merged || row.kind === "note" || row.cells.length !== years.length) continue;
    const parsed = row.cells.map(parseNumber);
    if (parsed.some((v) => v === undefined)) continue;
    if (parsed.every((v) => v === null)) continue;
    const child = row.kind === "sub" && hasParent;
    if (row.kind !== "sub" && row.kind !== "total") hasParent = true;
    numeric.push({ label: row.label, values: parsed as (number | null)[], total: row.kind === "total", child });
  }

  const total = numeric.find((r) => r.total);
  // "(경영평가 성과급)"처럼 위 줄에 딸린 줄은 이미 위 줄에 들어 있으므로 따로 쌓지 않는다
  const parts = numeric.filter((r) => !r.total && !r.child);
  const nonZero = parts.filter((r) => r.values.some((v) => v !== null && v !== 0));
  const shown = nonZero.slice(0, MAX_SERIES);
  if (shown.length === 0) return null;

  const base = {
    years: [...years],
    budget: years.map((y) => y.includes("예산")),
    unit: section.caption ? section.caption.replace(/^단위:\s*/, "") : null,
  };
  if (total && total.values.every((v) => v !== null)) {
    const totals = total.values.map((v) => v as number);
    const mismatch = totals.some((t, i) => {
      const sum = shown.reduce((s, r) => s + (r.values[i] ?? 0), 0);
      return Math.abs(sum - t) > Math.max(1, Math.abs(t) * 0.01) || nonZero.length > shown.length;
    });
    return { mode: "stacked", ...base, series: shown, totals, mismatch };
  }
  return { mode: "grouped", ...base, series: shown.slice(0, 4), totals: null, mismatch: false };
}

export interface BarSegment {
  label: string;
  value: number;
  /** 0~100. 가장 긴 막대를 100으로 본 길이 */
  percent: number;
}

/** 기관별 의심 항목 수를 신뢰도별로 나눈 막대 데이터 (순위가 있는 기관만) */
export function buildFindingBars(
  institutions: readonly { institution: string; rank: number | null; countsByConfidence: { 높음: number; 중간: number; 낮음: number } }[],
): { institution: string; high: number; mid: number; low: number; total: number; percent: number }[] {
  const rows = institutions
    .filter((i) => i.rank !== null)
    .map((i) => ({
      institution: i.institution,
      high: i.countsByConfidence.높음,
      mid: i.countsByConfidence.중간,
      low: i.countsByConfidence.낮음,
      total: i.countsByConfidence.높음 + i.countsByConfidence.중간 + i.countsByConfidence.낮음,
    }));
  const max = Math.max(1, ...rows.map((r) => r.total));
  return rows.map((r) => ({ ...r, percent: (r.total / max) * 100 }));
}

export interface StatusPart {
  key: "done" | "waiting-criteria" | "none" | "problem" | "progress";
  label: string;
  count: number;
}

/** 파일별 결과의 상태를 다섯 가지로 묶어 센다 (0건인 묶음은 뺀다) */
export function countStatuses(states: readonly string[]): StatusPart[] {
  const bucket = (s: string): StatusPart["key"] => {
    if (s === "ready" || s === "unclassified") return "done";
    if (s === "unchecked") return "waiting-criteria";
    if (s === "failed" || s === "unreadable") return "problem";
    if (s === "waiting" || s === "running") return "progress";
    return "none"; // 보고서 없음 · 중복 · 쓰지 않음
  };
  const labels: Record<StatusPart["key"], string> = {
    done: "점검 완료",
    "waiting-criteria": "점검 기준 준비 중",
    none: "보고서 없음·중복",
    problem: "실패·처리 불가",
    progress: "진행 중",
  };
  const counts = new Map<StatusPart["key"], number>();
  for (const s of states) counts.set(bucket(s), (counts.get(bucket(s)) ?? 0) + 1);
  return (["done", "waiting-criteria", "none", "problem", "progress"] as const)
    .filter((k) => (counts.get(k) ?? 0) > 0)
    .map((k) => ({ key: k, label: labels[k], count: counts.get(k) as number }));
}
