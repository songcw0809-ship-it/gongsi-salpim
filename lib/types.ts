// Design Ref: DESIGN.md §2.3 — 서버와 브라우저가 주고받는 데이터 모양은 lib/types.ts 한 곳에 둔다.
// 지금은 글자 뽑기(PLAN 3번)에 필요한 것만 있고, 이후 작업에서 FileResult·Finding 등을 더한다.

/** 글자를 뽑은 한 덩어리. PDF는 쪽 단위, 엑셀은 칸 단위. */
export interface TextUnit {
  /** 원문 위치. PDF는 "3쪽", 엑셀은 "시트명!B3" */
  location: string;
  text: string;
}

/** 파일에서 글자를 뽑은 결과. */
export type ExtractResult =
  /** 글자를 뽑았다 */
  | { status: "ok"; units: TextUnit[] }
  /** 스캔본처럼 글자가 없어 읽을 수 없다 (PRD 5번 M1) */
  | { status: "unreadable"; reason: string }
  /** 손상된 파일 등으로 읽는 도중 오류가 났다 */
  | { status: "failed"; reason: string };
