// Design Ref: DESIGN.md §2.3 — 알리오 가져오기 API가 브라우저에 돌려주는 데이터 모양.
import type { FileResult } from "../types.ts";
import type { Institution } from "./client.ts";

export type AlioOutcome =
  | "checked" //        가져와서 내장 점검 기준으로 대조까지 마침
  | "extracted-only" // 가져와서 값만 뽑음. 이 항목은 점검 기준이 없어 AI 대조를 하지 않음 ("점검 기준 준비 중")
  | "not-found" //      그 기관에 해당 보고서가 없음. 기관이 제출하지 않았다고 단정하지 않는다
  | "fetch-failed" //   알리오에서 가져오지 못함 (연결·시간 초과·화면 변경·크기 초과). 다시 시도할 수 있음
  | "check-failed"; //  가져왔지만 글자를 읽을 수 없거나(스캔본) AI 점검에 실패함. result.status 로 구분

export interface AlioCheckResponse {
  outcome: AlioOutcome;
  institution: { id: string; name: string };
  item: { no: string; name: string; formNo: string; hasChecklist: boolean };
  /** 가져온 보고서의 연도·분기. 알아내지 못하면 null */
  period: string | null;
  /** outcome 이 checked · extracted-only · check-failed 일 때 */
  result?: FileResult;
  /** outcome 이 fetch-failed 일 때 이유 */
  reason?: string;
}

export interface AlioInstitutionsResponse {
  institutions: Institution[];
  /** 조회 칸에 보일 기관 유형·주무 부처 선택지 */
  filters: { types: string[]; ministries: string[] };
  /** 화면이 지킬 상한 */
  limits: { maxInstitutions: number; maxRequests: number };
}
