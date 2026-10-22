// Design Ref: DESIGN.md §1.2 ② — 파일별 결과 표에 보일 줄을 만든다.
// Plan SC: PLAN.md 11번 — 기관·항목 종류·상태·추출한 값 표시, 중복 파일 중 사용할 파일 고르기, 점검 실패 다시 시도.
//
// 같은 이름의 파일이 있어도 헷갈리지 않게 파일 이름이 아니라 화면의 파일 번호(id)로 중복을 따진다.
// 이 파일은 일반 함수만 있어서 화면 없이 시험할 수 있다 (scripts/check_results.mjs).
import { organize, slotKey } from "./aggregate.ts";
import { CHECKLIST } from "./checklist.ts";
import type { ItemType } from "./checklist.ts";
import type { ClassifiedFile, ExtractedField, FileResult, FileState } from "./types.ts";

/** 체크리스트가 알고 있는 항목 종류들 (lib/check-file.ts 의 ITEM_TYPES 와 같은 값. 그 파일은 서버 코드라 브라우저에서 못 가져온다) */
export const ITEM_TYPES: readonly ItemType[] = [
  ...new Set(CHECKLIST.map((r) => r.scope).filter((s): s is ItemType => s !== "공통")),
];

/** 표를 만들 때 필요한 파일 한 개의 정보 (화면의 상태에서 뽑아 온다) */
export interface ViewInput {
  id: number;
  fileName: string;
  /** "waiting"·"running"은 아직 결과가 없는 파일, "done"은 서버가 결과를 돌려준 파일, "error"는 서버에 연결하지 못했거나 서버가 거절한 파일 */
  phase: "waiting" | "running" | "done" | "error";
  result?: FileResult;
  /** phase 가 "error" 일 때의 이유 */
  reason?: string;
}

export type RowState = FileState | "waiting" | "running";

export interface ResultRow {
  id: number;
  fileName: string;
  /** 모르면 "기관 미확인" */
  institution: string;
  /** 모르면 "항목 종류 미확인" */
  itemType: string;
  state: RowState;
  /** 상태 배지에 보일 문구 */
  stateLabel: string;
  /** 상태 아래에 보일 설명 (이유, 안내, 의심 항목 수 등) */
  note?: string;
  /** 점검 실패라서 다시 시도할 수 있는 파일 */
  canRetry: boolean;
  /** 같은 기관·같은 항목의 다른 파일과 겹쳐 담당자가 고르기 전인 파일 */
  canChoose: boolean;
  /** 중복에서 담당자가 이 파일을 사용하기로 고른 파일 */
  isChosen: boolean;
  /** 중복을 해소할 때 choices 에 넣을 열쇠 (기관·항목을 알 때만) */
  choiceKey?: string;
  extracted: ExtractedField[];
}

const STATE_LABEL: Record<RowState, string> = {
  ready: "완료",
  duplicate: "중복",
  excluded: "쓰지 않음",
  unclassified: "완료",
  unreadable: "처리 불가",
  failed: "점검 실패",
  waiting: "대기",
  running: "점검 중",
};

function toClassified(input: ViewInput): ClassifiedFile {
  // 중복 판정에는 파일 이름 대신 파일 번호를 쓴다
  const key = String(input.id);
  const r = input.result;
  if (input.phase === "error" || !r) {
    return { fileName: key, status: "failed", institution: null, itemType: null, reason: input.reason ?? "점검 실패" };
  }
  return { fileName: key, status: r.status, institution: r.institution, itemType: r.itemType, reason: r.reason };
}

/** 의심 항목이 하나도 없을 때 보이는 문구. "이상 없음"이라고 쓰지 않는다 (PRD 5번 M2). */
export const NO_FINDINGS_NOTE = "발견된 의심 항목 없음. AI가 놓쳤을 수 있으니 담당자 확인이 필요합니다";

/** 의심 항목 수를 한 줄로. 의심 항목이 없어도 "이상 없음"이라고 쓰지 않는다 (PRD 5번 M2). */
export function findingsNote(result: FileResult): string {
  if (result.findings.length === 0) {
    return NO_FINDINGS_NOTE;
  }
  const high = result.findings.filter((f) => f.confidence === "높음").length;
  return `오류 가능성 ${result.findings.length}건 (신뢰도 높음 ${high}건)`;
}

/**
 * 화면 상태에서 결과 표의 줄들을 만든다. 입력 순서를 그대로 지킨다.
 *
 * @param inputs 점검을 시작한 파일들
 * @param choices 중복에서 담당자가 고른 파일. { [choiceKey]: 파일 번호(문자열) }
 */
export function buildResultRows(
  inputs: readonly ViewInput[],
  choices: Readonly<Record<string, string>> = {},
): ResultRow[] {
  const finished = inputs.filter((i) => i.phase === "done" || i.phase === "error");
  const organized = organize(finished.map(toClassified), ITEM_TYPES, choices);
  const stateById = new Map(finished.map((f, i) => [f.id, organized.files[i]]));

  return inputs.map((input): ResultRow => {
    const org = stateById.get(input.id);
    const result = input.result;

    if (!org) {
      const state: RowState = input.phase === "running" ? "running" : "waiting";
      return {
        id: input.id, fileName: input.fileName,
        institution: "-", itemType: "-",
        state, stateLabel: STATE_LABEL[state],
        canRetry: false, canChoose: false, isChosen: false, extracted: [],
      };
    }

    const state = org.state;
    const known = input.phase === "done" && result?.institution && result.itemType;
    // 정상 파일에는 의심 항목 수를 함께 보인다. 기관·항목을 모르는 파일은 순위에 들어가지 않는다는 점을 알린다.
    const own = state === "unclassified" ? "순위에 반영되지 않음" : org.note;
    const showFindings = result?.status === "ok" && (state === "ready" || state === "unclassified");
    const note = showFindings ? [own, findingsNote(result)].filter(Boolean).join(" · ") : own;
    return {
      id: input.id,
      fileName: input.fileName,
      institution: org.institutionLabel,
      itemType: org.itemTypeLabel,
      state,
      stateLabel: STATE_LABEL[state],
      note,
      canRetry: state === "failed",
      canChoose: state === "duplicate",
      isChosen: state === "ready" && org.note === "사용할 파일로 선택됨",
      choiceKey: known ? slotKey(result.institution as string, result.itemType as ItemType) : undefined,
      extracted: state === "unreadable" || state === "failed" ? [] : (result?.extracted ?? []),
    };
  });
}
