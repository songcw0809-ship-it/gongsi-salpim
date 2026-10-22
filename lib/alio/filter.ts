// Design Ref: DESIGN.md §1.2 ① — 기관 유형·주무 부처로 기관 목록을 거른다.
// Plan SC: PLAN.md 9-1 — 기관 유형·주무 부처로 거르기. 일반 함수만 있어서 브라우저와 서버 모두에서 쓸 수 있다.
import type { Institution } from "./client.ts";

export interface InstitutionFilter {
  /** 고른 기관 유형들. 비어 있으면 거르지 않음 */
  types?: readonly string[];
  /** 고른 주무 부처들. 비어 있으면 거르지 않음 */
  ministries?: readonly string[];
  /** 기관명에 들어 있어야 하는 글자 (띄어쓰기 무시) */
  query?: string;
}

const squash = (s: string) => s.normalize("NFC").replace(/\s+/g, "");

/** 유형과 부처는 "또는"으로, 서로는 "그리고"로 묶는다. 예: 유형이 공기업이거나 준정부기관이고, 부처가 통일부인 기관. */
export function filterInstitutions(list: readonly Institution[], filter: InstitutionFilter): Institution[] {
  const query = filter.query ? squash(filter.query) : "";
  return list.filter(
    (i) =>
      (!filter.types?.length || filter.types.includes(i.type)) &&
      (!filter.ministries?.length || filter.ministries.includes(i.ministry)) &&
      (!query || squash(i.name).includes(query)),
  );
}

/** 목록에 실제로 있는 기관 유형과 주무 부처 (조회 칸에 보일 선택지). 가나다순. */
export function filterChoices(list: readonly Institution[]): { types: string[]; ministries: string[] } {
  const collect = (pick: (i: Institution) => string) =>
    [...new Set(list.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  return { types: collect((i) => i.type), ministries: collect((i) => i.ministry) };
}
