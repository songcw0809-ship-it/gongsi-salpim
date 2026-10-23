// Design Ref: DESIGN.md §3.4 — 내장 체크리스트는 lib/checklist.ts 한 곳에 둔다.
// Plan SC: PLAN.md 1번 — 별표 1의 10·11번과 공통 기준 13개, 조항 번호 포함.
//
// 기준 출처: 「공공기관의 통합공시에 관한 기준」(2025.12.30 개정)
// 이 체크리스트에 없는 규정은 점검에 쓰지 않는다(PRD 5번 M2).

export type ItemType = "임원연봉" | "직원평균보수";

export type RuleScope = ItemType | "공통";

export type RuleCategory =
  | "필수 기재사항"
  | "남녀 구분"
  | "기준 시점"
  | "5년 자료"
  | "갱신 시한";

export interface ChecklistRule {
  /** 기준 번호. 지적마다 이 번호를 붙인다. 예: "R10-1" */
  id: string;
  scope: RuleScope;
  category: RuleCategory;
  /** AI에게 물을 점검 질문 */
  question: string;
  /** 고시 원문에서 가져온 기준 문구 */
  criterion: string;
  /** 고시 안의 위치 */
  source: string;
}

export const CHECKLIST_BASIS = {
  name: "공공기관의 통합공시에 관한 기준",
  revisedAt: "2025-12-30",
} as const;

const SOURCE_10 = "별표 1 10번 임원연봉";
const SOURCE_11 = "별표 1 11번 직원 평균보수";

export const CHECKLIST: readonly ChecklistRule[] = [
  // 10. 임원연봉 (정기공시: 연 1회 4월말, 연도말 결산기준·당해연도는 예산기준)
  {
    id: "R10-1",
    scope: "임원연봉",
    category: "필수 기재사항",
    question: "임원별 기본급(기본연봉)이 기재되어 있는가?",
    criterion: "임원별 기본급(기본연봉)",
    source: SOURCE_10,
  },
  {
    id: "R10-2",
    scope: "임원연봉",
    category: "필수 기재사항",
    question: "항목별 수당이 기재되어 있는가?",
    criterion: "항목별 수당",
    source: SOURCE_10,
  },
  {
    id: "R10-3",
    scope: "임원연봉",
    category: "필수 기재사항",
    question: "급여성 복리후생비가 기재되어 있는가?",
    criterion: "급여성 복리후생비",
    source: SOURCE_10,
  },
  {
    id: "R10-4",
    scope: "임원연봉",
    category: "필수 기재사항",
    question: "경영평가 성과급이 기재되어 있는가?",
    criterion: "경영평가 성과급",
    source: SOURCE_10,
  },
  {
    id: "R10-5",
    scope: "임원연봉",
    category: "필수 기재사항",
    question: "기타 성과상여금이 기재되어 있는가?",
    criterion: "기타 성과상여금",
    source: SOURCE_10,
  },
  {
    id: "R10-6",
    scope: "임원연봉",
    category: "필수 기재사항",
    question: "임원의 성별 평균보수가 기재되어 있는가?",
    criterion: "임원의 성별 평균보수",
    source: SOURCE_10,
  },
  {
    id: "R10-7",
    scope: "임원연봉",
    category: "기준 시점",
    question:
      "기준 시점이 연도말 결산기준(당해연도는 예산기준)으로 표시되어 있는가?",
    criterion: "연도말 결산기준, 당해 연도는 예산기준",
    source: SOURCE_10,
  },

  // 11. 직원 평균보수 (정기공시: 연 1회 4월말)
  {
    id: "R11-1",
    scope: "직원평균보수",
    category: "필수 기재사항",
    question:
      "직원 1인당 기본급, 항목별 수당, 경영평가 성과급, 기타 성과상여금이 기재되어 있는가?",
    criterion: "직원 1인당 기본급, 항목별 수당, 경영평가 성과급, 기타 성과상여금",
    source: SOURCE_11,
  },
  {
    id: "R11-2",
    scope: "직원평균보수",
    category: "남녀 구분",
    question: "직원 1인당 평균 보수가 남성·여성으로 구분되어 있는가?",
    criterion: "직원 1인당 평균 보수 및 비율 (남성, 여성)",
    source: SOURCE_11,
  },
  {
    id: "R11-3",
    scope: "직원평균보수",
    category: "남녀 구분",
    question: "직원 평균근속연수가 남성·여성으로 구분되어 있는가?",
    criterion: "직원 평균근속연수(남성, 여성)",
    source: SOURCE_11,
  },
  {
    id: "R11-4",
    scope: "직원평균보수",
    category: "필수 기재사항",
    question: "신입직원 평균보수가 기재되어 있는가?",
    criterion: "신입직원 평균보수",
    source: SOURCE_11,
  },

  // 공통 (모든 항목에 적용)
  {
    id: "C-1",
    scope: "공통",
    category: "5년 자료",
    question:
      "문서에 적힌 공시 기간이 최근 5년에 못 미치는데 그 사유를 적지 않았는가? (표에 연도별 구분이 없다는 것만으로는 해당하지 않는다)",
    criterion:
      "최근 5년간의 자료를 공시하는 것을 원칙으로 한다. 다만, 최근 5년간의 자료가 없거나 공시할 수 없는 경우에는 자료를 확보할 수 있는 기간 동안의 자료를 공시하고, 자료를 확보할 수 없는 기간의 자료에 대해서는 그 사유를 게재한다",
    source: "제3조(자료 공시의 원칙)",
  },
  {
    id: "C-2",
    scope: "공통",
    category: "갱신 시한",
    question: "정기공시 갱신 주기(매년 4월말)를 지켜 공시했는가?",
    criterion:
      "정기공시 사항은 항목별 갱신주기에 따라 매년(4월말) 또는 매 반기(4월말, 10월말) 또는 매 분기(1월말, 4월말, 7월말, 10월말)에 일괄 공시한다",
    source: "제6조(자료 공시의 시점) 제2항",
  },
];

/** 항목 종류에 해당하는 기준 + 공통 기준을 돌려준다 (AI 대조 단계에서 사용). */
export function rulesFor(itemType: ItemType): ChecklistRule[] {
  return CHECKLIST.filter((r) => r.scope === itemType || r.scope === "공통");
}

/** 기준 번호로 기준을 찾는다. 없으면 undefined (검증 장치에서 근거 없는 지적을 거를 때 사용). */
export function findRule(id: string): ChecklistRule | undefined {
  return CHECKLIST.find((r) => r.id === id);
}

/** 지적을 받은 기관에 어떻게 보완을 요청하면 좋은지. 담당자가 참고하는 예시이며 앱이 파일을 고치거나 기관에 연락하지는 않는다. */
export interface FixHint {
  /** 무엇을 고치면 되는지 */
  action: string;
  /** 보고서에 이렇게 적으면 된다는 예시 (금액·이름은 예를 들기 위한 가짜 값) */
  example: string;
}

const FIX_HINTS: Readonly<Record<string, FixHint>> = {
  "R10-1": { action: "임원별 기본급(기본연봉) 항목을 표에 추가해 금액을 적습니다.", example: "상임기관장 | 기본급 | 145,092 (단위: 천원)" },
  "R10-2": { action: "고정수당·실적수당 등 항목별 수당을 구분해 적고, 해당이 없으면 0이나 '해당사항 없음'으로 적습니다.", example: "상임감사 | 고정수당 | 0   /   실적수당 | 0" },
  "R10-3": { action: "급여성 복리후생비를 항목으로 두고 금액을 적습니다. 없으면 0으로 적습니다.", example: "상임이사 | 급여성 복리후생비 | 0" },
  "R10-4": { action: "경영평가 성과급을 항목으로 두고 금액을 적습니다. 당해연도 예산이 미확정이면 0으로 적고 사유를 주석으로 답니다.", example: "상임기관장 | 경영평가 성과급 | 88,918   (주석: 당해연도는 경영평가 결과 미확정으로 0으로 기재)" },
  "R10-5": { action: "경영평가 성과급 외의 기타 성과상여금을 항목으로 두고 금액을 적습니다. 없으면 0으로 적습니다.", example: "상임감사 | 기타 성과상여금 | 0" },
  "R10-6": { action: "임원의 성별(남성·여성) 평균보수를 적는 표나 문구를 추가합니다. 해당 성별 임원이 없으면 그 사실을 적습니다.", example: "임원 성별 평균보수 | 남성 150,000 | 여성 해당 임원 없음" },
  "R10-7": { action: "기준 시점을 '연도말 결산기준, 당해연도는 예산기준'으로 분명하게 적습니다.", example: "기준 시점: 2025년 12월 31일 결산 기준 (2026년은 예산 기준)" },
  "R11-1": { action: "직원 1인당 기본급, 항목별 수당, 경영평가 성과급, 기타 성과상여금을 각각 적습니다.", example: "직원 1인당 | 기본급 45,000 | 고정수당 3,000 | 실적수당 2,000 | 경영평가 성과급 10,000 | 기타 성과상여금 1,000" },
  "R11-2": { action: "직원 1인당 평균 보수를 남성·여성으로 나누어 적고 비율도 함께 적습니다.", example: "직원 1인당 평균 보수 | 남성 62,000 | 여성 57,000 | 여성/남성 비율 91.9%" },
  "R11-3": { action: "직원 평균근속연수를 남성·여성으로 나누어 적습니다.", example: "평균근속연수 | 남성 12.4년 | 여성 9.8년" },
  "R11-4": { action: "신입직원 평균보수 항목을 추가해 금액을 적습니다.", example: "신입직원 평균보수 | 33,000 (단위: 천원)" },
  "C-1": { action: "공시 기간을 최근 5년으로 채우고, 자료를 확보할 수 없는 연도는 그 사유를 함께 적습니다.", example: "공시 기간: 2021년~2025년   /   2021~2022년: 기관 설립(2023년) 이전이라 자료 없음" },
  "C-2": { action: "정기공시는 갱신주기(매년 4월말) 안에 올리도록 보완을 요청합니다. 공시일은 알리오의 공시 이력과 함께 확인합니다.", example: "공시일: 2026-04-30 이전 (예: 2026-04-28)" },
};

/** 기준 번호에 맞는 수정 예시. 없으면 undefined */
export function fixHintFor(ruleId: string): FixHint | undefined {
  return FIX_HINTS[ruleId];
}
