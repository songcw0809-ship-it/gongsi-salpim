// Design Ref: DESIGN.md §1.2 ④ — 의심 항목 상세 패널에 보일 데이터를 만든다.
// Plan SC: PLAN.md 13번 — 지적마다 근거 기준(번호 포함)·원문 위치·신뢰도를 함께 보이고,
//          의심 항목이 없으면 "발견된 의심 항목 없음" 문구를 보인다 (PRD 5번 M2).
//
// 이 파일은 일반 함수만 있어서 화면 없이 시험할 수 있다 (scripts/check_detail.mjs).
import { findRule } from "./checklist.ts";
import { maskAll } from "./mask.ts";
import { NO_FINDINGS_NOTE } from "./result-view.ts";
import type { Confidence, InstitutionSummary } from "./types.ts";

export interface DetailItem {
  ruleId: string;
  message: string;
  confidence: Confidence;
  /** 근거가 된 기준 문구 (체크리스트의 criterion) */
  criterion: string;
  /** 기준이 고시의 어디에 있는지. 예: "별표 1 10번 임원연봉" */
  source: string;
  /** 원문에서 따온 인용문 */
  quote: string;
  /** 원문 위치. PDF는 쪽 번호, 엑셀은 시트명과 칸 주소 */
  location: string;
}

export interface DetailGroup {
  itemType: string;
  /** 화면에 보일 파일 이름 */
  fileName: string;
  items: DetailItem[];
}

export interface Detail {
  institution: string;
  /** 순위. 순위에서 제외된 기관이면 null */
  rank: number | null;
  groups: DetailGroup[];
  /** 지적이 하나도 없을 때 보일 문구. 지적이 있으면 null */
  emptyMessage: string | null;
  /** "중복 선택 필요", "업로드되지 않음: …" 같은 안내 */
  note: string | null;
  /** 개인정보로 보여서 가린 값의 수 (화면 표시용으로만 가림) */
  maskedCount: number;
}

/**
 * 기관 한 곳의 상세를 만든다.
 *
 * 지적은 항목 종류·파일별로 묶고, 신뢰도 높은 것부터 보인다(요약 단계에서 이미 정렬돼 있다).
 * 체크리스트에서 기준을 찾을 수 없는 지적은 근거를 댈 수 없으므로 보이지 않는다.
 *
 * @param institution 기관별 요약의 한 줄 (lib/aggregate.ts 의 summarize 결과)
 * @param nameOf 파일 번호(문자열)를 화면에 보일 파일 이름으로 바꾸는 함수
 */
export function buildDetail(institution: InstitutionSummary, nameOf: (fileKey: string) => string): Detail {
  const groups: DetailGroup[] = [];
  let maskedCount = 0;
  /** 화면에 보일 글자를 가리고 가린 수를 센다 */
  const mask = (text: string): string => {
    const m = maskAll([text]);
    maskedCount += m.count;
    return m.texts[0] as string;
  };
  for (const { itemType, fileName, finding } of institution.findings) {
    const rule = findRule(finding.ruleId);
    if (!rule) continue;
    const item: DetailItem = {
      ruleId: rule.id,
      message: mask(finding.message),
      confidence: finding.confidence,
      criterion: rule.criterion,
      source: rule.source,
      quote: mask(finding.evidence.quote),
      location: mask(finding.evidence.location),
    };
    // 파일 이름의 가림은 묶음을 새로 만들 때 한 번만 센다
    const shown = maskAll([nameOf(fileName)]);
    const shownName = shown.texts[0] as string;
    const group = groups.find((g) => g.itemType === itemType && g.fileName === shownName);
    if (group) group.items.push(item);
    else {
      maskedCount += shown.count;
      groups.push({ itemType, fileName: shownName, items: [item] });
    }
  }

  // 순위에서 제외된 기관은 지적을 세지 않았으므로 "의심 항목 없음"이라고 쓰면 안 된다.
  const empty = groups.length === 0;
  return {
    institution: institution.institution,
    rank: institution.rank,
    groups,
    emptyMessage: !empty
      ? null
      : institution.rank === null
        ? "점검 결과를 쓸 수 없어 순위에서 제외된 기관입니다. 아래 안내를 확인하세요"
        : NO_FINDINGS_NOTE,
    note: institution.note,
    maskedCount,
  };
}
