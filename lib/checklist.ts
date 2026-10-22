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
      "최근 5년간의 자료를 공시했는가? 자료가 없거나 공시할 수 없으면 그 사유를 적었는가?",
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
