// Design Ref: DESIGN.md §2.2 ⑤, §2.4 — 검증 장치: 근거 없는 지적은 버리고, 표현과 신뢰도를 정리한다.
// Plan SC: PLAN.md 6번 — 근거 조항·원문 위치가 없는 지적 버리기, "오류 가능성" 표현, 신뢰도 붙이기.
//
// AI가 낸 지적을 그대로 믿지 않는다. 아래 규칙을 모두 통과한 지적만 화면에 보낸다.
//
//   1. 기준 번호가 이 파일에 적용되는 체크리스트에 없으면 버린다.
//   2. 인용문이 실제로 뽑은 글자에 없으면 버린다. 근거를 대지 못하면 지적하지 않는다 (PRD 5번 M2).
//      - 인용문 일치는 공백과 말줄임표를 뺀 부분 일치로 판정한다.
//      - 항목이 빠졌다는 지적은 그 항목이 있어야 할 표·구역의 제목 문구를 인용문으로 삼는다.
//   3. 원문 위치는 AI가 적은 값을 믿지 않고, 인용문을 실제로 찾은 위치로 바꾼다.
//   4. 인용문 조각이 일부만 있으면 신뢰도를 한 단계 낮춘다. "높음"은 인용문이 모두 있을 때만 허용한다.
//   5. "오류입니다" 같은 단정을 "오류 가능성" 표현으로 바꾼다.
//   6. 같은 기준 번호의 지적이 여럿이면 신뢰도가 가장 높은 하나만 남긴다.
//
// 이 파일은 일반 함수만 있어서 AI 호출 없이 단독으로 시험할 수 있다.
import type { ChecklistRule } from "./checklist";
import type { Confidence, Finding, GuardResult, RawFinding, TextUnit } from "./types";

/** 인용문이 이보다 짧으면(공백 제외) 아무 글자에나 걸리므로 근거로 인정하지 않는다. */
export const MIN_QUOTE_CHARS = 4;

const ORDER: Confidence[] = ["높음", "중간", "낮음"];
const ELLIPSIS = /…|⋯|\.{3,}/;

const norm = (s: string) => s.normalize("NFC").replace(/\s+/g, "");

/** AI가 적은 신뢰도를 세 단계 중 하나로 맞춘다. 알 수 없으면 가장 낮게 본다. */
function toConfidence(raw: string | undefined): Confidence {
  if (!raw) return "낮음";
  if (raw.includes("높") || /high/i.test(raw)) return "높음";
  if (raw.includes("중") || /medium|mid/i.test(raw)) return "중간";
  return "낮음";
}

const lower = (c: Confidence): Confidence => ORDER[Math.min(ORDER.indexOf(c) + 1, 2)];

/** 단정 표현을 "오류 가능성" 표현으로 바꾸고, 항상 "오류 가능성:"으로 시작하게 한다. */
function hedge(message: string, fallback: string): string {
  let m = message
    .replace(/오류입니다|오류이다/g, "오류일 가능성이 있습니다")
    .replace(/틀렸습니다|틀렸다/g, "맞지 않을 가능성이 있습니다")
    .replace(/잘못되었습니다|잘못됐습니다/g, "잘못되었을 가능성이 있습니다")
    .replace(/위반입니다|위반이다/g, "위반일 가능성이 있습니다")
    .replace(/위반했습니다/g, "위반했을 가능성이 있습니다")
    .replace(/(명백히|확실히|분명히)\s*/g, "")
    .trim();
  if (!m) m = fallback;
  return m.startsWith("오류 가능성") ? m : `오류 가능성: ${m}`;
}

/**
 * AI가 낸 지적을 검증한다.
 *
 * @param raw AI가 돌려준 지적들
 * @param units 파일에서 뽑은 글자 (쪽 또는 칸 단위)
 * @param rules 이 파일에 적용되는 체크리스트 기준들 (항목 종류별 기준 + 공통 기준)
 */
export function verifyFindings(
  raw: readonly RawFinding[],
  units: readonly TextUnit[],
  rules: readonly ChecklistRule[],
): GuardResult {
  const normalized = units.map((u) => ({ location: u.location, text: norm(u.text) }));
  const best = new Map<string, { finding: Finding; rank: number; raw: RawFinding }>();
  const dropped: GuardResult["dropped"] = [];

  for (const r of raw) {
    const drop = (reason: string) => dropped.push({ raw: r, reason });

    // 1. 기준 번호
    const rule = rules.find((x) => x.id === r.ruleId);
    if (!rule) {
      drop("체크리스트에 없거나 이 파일에 적용되지 않는 기준 번호");
      continue;
    }

    // 2. 인용문
    const quote = r.evidence?.quote?.trim() ?? "";
    const segments = quote.split(ELLIPSIS).map(norm).filter((s) => s.length >= 2);
    const total = segments.reduce((n, s) => n + s.length, 0);
    if (!quote) {
      drop("인용문이 없음");
      continue;
    }
    if (total < MIN_QUOTE_CHARS) {
      drop("인용문이 너무 짧아 근거로 인정할 수 없음");
      continue;
    }

    // 3. 인용문을 실제로 찾은 위치
    const found = segments.map((s) => normalized.find((u) => u.text.includes(s)));
    const foundCount = found.filter(Boolean).length;
    const first = found.find(Boolean);
    if (!first) {
      drop("인용문이 파일의 글자에 없음");
      continue;
    }

    // 4. 신뢰도
    let confidence = toConfidence(r.confidence);
    if (foundCount < segments.length) confidence = lower(confidence);

    const finding: Finding = {
      ruleId: rule.id,
      message: hedge(r.message ?? "", `${rule.criterion} 관련 내용을 확인하세요`),
      confidence,
      evidence: { quote, location: first.location },
    };

    // 6. 같은 기준은 신뢰도가 가장 높은 하나만
    const rank = ORDER.indexOf(confidence);
    const prev = best.get(rule.id);
    if (!prev || rank < prev.rank) {
      if (prev) dropped.push({ raw: prev.raw, reason: "같은 기준의 다른 지적이 더 믿을 만해서 합침" });
      best.set(rule.id, { finding, rank, raw: r });
    } else {
      drop("같은 기준의 다른 지적이 더 믿을 만해서 합침");
    }
  }

  const findings = [...best.values()]
    .sort((a, b) => a.rank - b.rank || rules.findIndex((x) => x.id === a.finding.ruleId) - rules.findIndex((x) => x.id === b.finding.ruleId))
    .map((x) => x.finding);

  return { findings, dropped };
}
