// Design Ref: DESIGN.md §1.2 ② — 파일별 결과 표에 보일 줄을 만든다.
// Plan SC: PLAN.md 11번 — 기관·항목 종류·상태·추출한 값 표시, 중복 파일 중 사용할 파일 고르기, 점검 실패 다시 시도.
//          PLAN.md 10번 — 알리오에서 가져온 보고서(점검 기준 준비 중·보고서 없음 포함)도 같은 표에 보인다.
//
// 같은 이름의 파일이 있어도 헷갈리지 않게 파일 이름이 아니라 화면의 파일 번호(id)로 중복을 따진다.
// 이 파일은 일반 함수만 있어서 화면 없이 시험할 수 있다 (scripts/check_results.mjs).
import { organize, slotKey } from "./aggregate.ts";
import type { AlioOutcome } from "./alio/api-types.ts";
import { CHECKLIST } from "./checklist.ts";
import { alioItemUrl, alioPdfUrl } from "./alio/links.ts";
import { maskAll } from "./mask.ts";
import type { ItemType } from "./checklist.ts";
import type { ClassifiedFile, ExtractedField, FileResult, FileState } from "./types.ts";

/** 체크리스트가 알고 있는 항목 종류들 (lib/check-file.ts 의 ITEM_TYPES 와 같은 값. 그 파일은 서버 코드라 브라우저에서 못 가져온다) */
export const ITEM_TYPES: readonly ItemType[] = [
  ...new Set(CHECKLIST.map((r) => r.scope).filter((s): s is ItemType => s !== "공통")),
];

/** 알리오에서 가져온 보고서 한 건의 정보 */
export interface ViewAlio {
  institutionName: string;
  /** 알리오 항목 이름. 예: "임직원 수" */
  itemName: string;
  /** 보고서의 연도·분기. 모르면 null */
  period: string | null;
  /** 알리오 공시항목 번호. 알리오 화면 바로가기 링크에 쓴다 */
  formNo?: string;
  /** 알리오 공시번호. 보고서를 찾았을 때만 있고 PDF 받기 링크에 쓴다 */
  disclosureNo?: string;
  /** 알리오 가져오기 API의 결과. 서버에 연결하지 못해 결과를 못 받았으면 "request-failed" */
  outcome: AlioOutcome | "request-failed";
}

/** 표를 만들 때 필요한 파일 한 개의 정보 (화면의 상태에서 뽑아 온다) */
export interface ViewInput {
  id: number;
  fileName: string;
  /** "waiting"·"running"은 아직 결과가 없는 파일, "done"은 서버가 결과를 돌려준 파일, "error"는 서버에 연결하지 못했거나 서버가 거절한 파일 */
  phase: "waiting" | "running" | "done" | "error";
  result?: FileResult;
  /** phase 가 "error" 일 때의 이유 */
  reason?: string;
  /** 알리오에서 가져온 보고서이면 그 정보. 기관·항목은 AI가 읽은 값이 아니라 알리오 목록으로 정해진 값이다 */
  alio?: ViewAlio;
}

/** 알리오 보고서 중 순위·지적 계산에 넣지 않는 것: 점검 기준이 없어 값만 뽑은 것, 보고서가 없는 것 */
export function isAlioSkipped(input: ViewInput): boolean {
  return (
    input.phase === "done" && (input.alio?.outcome === "extracted-only" || input.alio?.outcome === "not-found")
  );
}

export type RowState = FileState | "waiting" | "running" | "unchecked" | "not-found";

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
  /** 알리오에서 가져온 건이면 알리오 화면·PDF 링크. 직접 올린 파일이면 null */
  alioLinks: { itemUrl: string | null; pdfUrl: string | null } | null;
  /** 개인정보로 보여서 가린 값의 수 (화면 표시용으로만 가리고 받은 결과는 그대로 둔다) */
  maskedCount: number;
}

/** 가리기 전의 줄 */
type RawRow = Omit<ResultRow, "maskedCount" | "alioLinks">;

/**
 * 화면에 보일 글자 중 개인정보로 보이는 값(전화번호·이메일·주민등록번호 형태)을 가린다.
 * 알리오에 공개된 보고서는 누구나 볼 수 있는 자료이므로 가리지 않는다(원문 대조가 쉽도록). 직접 올린 파일만 가린다.
 */
function maskRow(row: RawRow, alio: ViewAlio | undefined): ResultRow {
  const alioLinks = alio
    ? { itemUrl: alio.formNo ? alioItemUrl(alio.formNo) : null, pdfUrl: alio.disclosureNo ? alioPdfUrl(alio.disclosureNo) : null }
    : null;
  if (alio) return { ...row, alioLinks, maskedCount: 0 };
  const m = maskAll([row.fileName, row.institution, row.itemType, row.note, ...row.extracted.flatMap((e) => [e.label, e.value, e.location])]);
  const [fileName, institution, itemType, note, ...rest] = m.texts;
  return {
    ...row,
    fileName: fileName as string,
    institution: institution as string,
    itemType: itemType as string,
    note,
    extracted: row.extracted.map((_, i) => ({ label: rest[i * 3] as string, value: rest[i * 3 + 1] as string, location: rest[i * 3 + 2] as string })),
    alioLinks,
    maskedCount: m.count,
  };
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
  unchecked: "점검 기준 준비 중",
  "not-found": "보고서 없음",
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
 * @param inputs 점검을 시작한 파일들(알리오에서 가져온 보고서 포함)
 * @param choices 중복에서 담당자가 고른 파일. { [choiceKey]: 파일 번호(문자열) }
 */
export function buildResultRows(
  inputs: readonly ViewInput[],
  choices: Readonly<Record<string, string>> = {},
): ResultRow[] {
  const finished = inputs.filter((i) => (i.phase === "done" || i.phase === "error") && !isAlioSkipped(i));
  const organized = organize(finished.map(toClassified), ITEM_TYPES, choices);
  const stateById = new Map(finished.map((f, i) => [f.id, organized.files[i]]));

  const build = (input: ViewInput): RawRow => {
    const result = input.result;
    const alio = input.alio;
    const period = alio?.period ? `${alio.period} 보고서` : null;

    // 알리오에서 가져왔지만 순위·지적 계산에 넣지 않는 보고서
    if (alio && isAlioSkipped(input)) {
      const state: RowState = alio.outcome === "not-found" ? "not-found" : "unchecked";
      return {
        id: input.id,
        fileName: input.fileName,
        institution: alio.institutionName,
        itemType: alio.itemName,
        state,
        stateLabel: STATE_LABEL[state],
        note:
          state === "not-found"
            ? "알리오에서 보고서를 찾지 못함 (해당하지 않는 항목이거나 아직 공시 전일 수 있으며, 기관이 제출하지 않았다는 뜻은 아닙니다)"
            : [period, "이 항목은 내장 점검 기준이 없어 AI 대조를 하지 않았습니다. 순위에 반영되지 않습니다"]
                .filter(Boolean)
                .join(" · "),
        canRetry: false,
        canChoose: false,
        isChosen: false,
        extracted: state === "unchecked" ? (result?.extracted ?? []) : [],
      };
    }

    const org = stateById.get(input.id);
    if (!org) {
      const state: RowState = input.phase === "running" ? "running" : "waiting";
      return {
        id: input.id,
        fileName: input.fileName,
        institution: alio?.institutionName ?? "-",
        itemType: alio?.itemName ?? "-",
        state,
        stateLabel: STATE_LABEL[state],
        canRetry: false,
        canChoose: false,
        isChosen: false,
        extracted: [],
      };
    }

    const state = org.state;
    const known = input.phase === "done" && result?.institution && result.itemType;
    // 정상 파일에는 의심 항목 수를 함께 보인다. 기관·항목을 모르는 파일은 순위에 들어가지 않는다는 점을 알린다.
    const own = state === "unclassified" ? "순위에 반영되지 않음" : org.note;
    const showFindings = result?.status === "ok" && (state === "ready" || state === "unclassified");
    const parts = showFindings ? [period, own, findingsNote(result)] : [own];
    return {
      id: input.id,
      fileName: input.fileName,
      // 알리오에서 가져온 보고서의 기관·항목은 AI가 읽은 값이 아니라 목록으로 정해진 이름을 보인다
      institution: alio?.institutionName ?? org.institutionLabel,
      itemType: alio?.itemName ?? org.itemTypeLabel,
      state,
      stateLabel: STATE_LABEL[state],
      note: parts.filter(Boolean).join(" · ") || undefined,
      canRetry: state === "failed",
      canChoose: state === "duplicate",
      isChosen: state === "ready" && org.note === "사용할 파일로 선택됨",
      choiceKey: known ? slotKey(result.institution as string, result.itemType as ItemType) : undefined,
      extracted: state === "unreadable" || state === "failed" ? [] : (result?.extracted ?? []),
    };
  };

  return inputs.map((input) => maskRow(build(input), input.alio));
}
