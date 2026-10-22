// Design Ref: DESIGN.md §1.2 ① — 알리오에서 가져올 기관·항목 선택의 한도.
// Plan SC: PLAN.md 10번 — 기관은 최대 10곳, 기관×항목은 최대 20건. 한도를 넘기면 더 고르지 못하게 하고 이유를 알린다.
//
// 이 파일은 일반 함수만 있어서 화면 없이 시험할 수 있다 (scripts/check_alio_select.mjs).
import { ALIO_MAX_INSTITUTIONS, ALIO_MAX_REQUESTS } from "../limits.ts";

export interface Selection {
  /** 고른 기관 코드들 */
  institutions: number;
  /** 고른 공시 항목 수 */
  items: number;
}

/** 가져올 보고서 수 = 기관 수 × 항목 수 */
export function requestCount(sel: Selection): number {
  return sel.institutions * sel.items;
}

export type Allowed = { ok: true } | { ok: false; reason: string };

/** 기관을 하나 더 고를 수 있는가 */
export function canAddInstitution(sel: Selection): Allowed {
  if (sel.institutions + 1 > ALIO_MAX_INSTITUTIONS) {
    return { ok: false, reason: `기관은 한 번에 최대 ${ALIO_MAX_INSTITUTIONS}곳까지 고를 수 있습니다` };
  }
  if ((sel.institutions + 1) * sel.items > ALIO_MAX_REQUESTS) {
    return { ok: false, reason: `기관×항목이 ${ALIO_MAX_REQUESTS}건을 넘어 기관을 더 고를 수 없습니다` };
  }
  return { ok: true };
}

/** 공시 항목을 하나 더 고를 수 있는가 */
export function canAddItem(sel: Selection): Allowed {
  if (sel.institutions * (sel.items + 1) > ALIO_MAX_REQUESTS) {
    return { ok: false, reason: `기관×항목이 ${ALIO_MAX_REQUESTS}건을 넘어 항목을 더 고를 수 없습니다` };
  }
  return { ok: true };
}

/** 점검을 시작할 수 없는 이유. 시작할 수 있으면 null */
export function startBlockReason(sel: Selection): string | null {
  if (sel.items === 0) return "공시 항목을 하나 이상 고르세요";
  if (sel.institutions === 0) return "기관을 하나 이상 고르세요";
  if (sel.institutions > ALIO_MAX_INSTITUTIONS) return `기관은 최대 ${ALIO_MAX_INSTITUTIONS}곳입니다`;
  if (requestCount(sel) > ALIO_MAX_REQUESTS) return `기관×항목은 최대 ${ALIO_MAX_REQUESTS}건입니다`;
  return null;
}

/** 기관 순서대로, 기관마다 고른 항목 순서대로 가져올 건들을 펼친다 */
export function expandRequests<I, T>(institutions: readonly I[], items: readonly T[]): { institution: I; item: T }[] {
  return institutions.flatMap((institution) => items.map((item) => ({ institution, item })));
}
