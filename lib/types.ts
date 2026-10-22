// Design Ref: DESIGN.md §2.3 — 서버와 브라우저가 주고받는 데이터 모양은 lib/types.ts 한 곳에 둔다.
// 지금은 글자 뽑기(PLAN 3번)에 필요한 것만 있고, 이후 작업에서 FileResult·Finding 등을 더한다.

import type { ItemType } from "./checklist";

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

/** 글자를 뽑고 기관명·항목 종류 분류까지 끝난 파일 한 개 (분류는 AI 단계가 채운다). */
export interface ClassifiedFile {
  fileName: string;
  status: "ok" | "unreadable" | "failed";
  /** null이면 "기관 미확인" */
  institution: string | null;
  /** null이면 "항목 종류 미확인" */
  itemType: ItemType | null;
  reason?: string;
}

/** 파일 한 개가 화면에서 어떤 상태로 보이는가. */
export type FileState =
  | "ready" //        정상 (순위 계산에 쓸 수 있음)
  | "duplicate" //    같은 기관·같은 항목 파일이 2개 이상이고 아직 고르지 않음
  | "excluded" //     중복 중 담당자가 고르지 않은 쪽
  | "unclassified" // 기관 미확인 또는 항목 종류 미확인
  | "unreadable" //   글자를 읽을 수 없음
  | "failed"; //      점검 실패

export interface OrganizedFile {
  fileName: string;
  state: FileState;
  /** 화면에 보일 기관명. 모르면 "기관 미확인" */
  institutionLabel: string;
  /** 화면에 보일 항목 종류. 모르면 "항목 종류 미확인" */
  itemTypeLabel: string;
  /** 화면에 보일 설명 (이유, 안내 등) */
  note?: string;
}

/** 한 기관의 항목 종류 한 칸. */
export interface ItemSlot {
  itemType: ItemType;
  fileNames: string[];
  status: "uploaded" | "duplicate" | "missing";
  /** 중복에서 담당자가 고른 파일 */
  chosen?: string;
  /** "업로드되지 않음"·"중복" 같은 표시 문구. 정상이면 빈 문자열 */
  label: string;
}

export interface InstitutionGroup {
  institution: string;
  slots: ItemSlot[];
  /** true이면 순위 계산에서 뺀다 (PRD 5번 M1, DESIGN §2.4) */
  hasUnresolvedDuplicate: boolean;
}

export interface Organized {
  /** 입력 순서 그대로, 파일마다 화면 상태 */
  files: OrganizedFile[];
  /** 기관이 확인된 파일만 기관별로 묶음 (기관명 가나다순) */
  institutions: InstitutionGroup[];
  /** 기관 미확인·항목 종류 미확인 파일 이름 (순위에서 제외) */
  unassigned: string[];
}
