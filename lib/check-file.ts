// Design Ref: DESIGN.md §2.1 — 파일 1개를 받아 ②글자 뽑기 → ③분류·추출 → ④대조 → ⑤검증까지 한 번에 한다.
// Plan SC: PLAN.md 5번 — 파일 1개 → 지적 목록(FileResult). 여러 파일을 받는 API는 PLAN 8번에서 이 함수를 부른다.
import { UPLOAD_ITEM_TYPES } from "./checklist.ts";
import type { ItemType } from "./checklist.ts";
import { extractExcel } from "./extract/excel.ts";
import { extractPdf } from "./extract/pdf.ts";
import { analyzeDocument, analyzeKnownDocument } from "./ai/analyze.ts";
import type { AiClient } from "./ai/analyze.ts";
import { isAllowedModel } from "./ai/models.ts";
import type { ExtractResult, FileResult } from "./types.ts";

/** 체크리스트가 알고 있는 항목 종류들. 항목을 추가하면 자동으로 늘어난다. */
export const ITEM_TYPES: readonly ItemType[] = UPLOAD_ITEM_TYPES;

function extract(fileName: string, bytes: Uint8Array): Promise<ExtractResult> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return extractPdf(bytes);
  if (lower.endsWith(".xlsx")) return extractExcel(bytes);
  return Promise.resolve({ status: "failed", reason: "지원하지 않는 파일 형식" });
}

/** AI 오류 메시지에는 요청 내용이 섞일 수 있어서, 화면에 보낼 이유는 짧고 일반적으로만 적는다. */
function describeError(e: unknown): string {
  if (e instanceof Error && e.message === "문서가 너무 길어 점검할 수 없음") return e.message;
  const status = (e as { status?: unknown })?.status;
  return typeof status === "number" ? `AI 호출 실패 (${status})` : "점검 중 오류가 났습니다";
}

export async function checkFile(args: {
  fileName: string;
  bytes: Uint8Array;
  /** 허용 목록에 있는 모델 이름. 그 밖의 이름이면 오류를 던진다 */
  model: string;
  ai: AiClient;
}): Promise<FileResult> {
  const { fileName, bytes, model, ai } = args;
  if (!isAllowedModel(model)) throw new Error("허용되지 않은 AI 모델");

  const started = Date.now();
  const base = { fileName, institution: null, itemType: null, extracted: [], findings: [], model };
  const done = (partial: Partial<FileResult> & Pick<FileResult, "status">): FileResult => ({
    ...base,
    ...partial,
    elapsedMs: Date.now() - started,
  });

  // ② 글자 뽑기: 스캔본·손상된 파일은 AI를 부르지 않는다.
  const text = await extract(fileName, bytes);
  if (text.status !== "ok") return done({ status: text.status, reason: text.reason });

  try {
    const a = await analyzeDocument({ units: text.units, model, ai, itemTypes: ITEM_TYPES });
    return done({
      status: "ok",
      institution: a.institution,
      itemType: a.itemType,
      extracted: a.extracted,
      findings: a.findings,
      usage: a.usage,
    });
  } catch (e) {
    return done({ status: "failed", reason: describeError(e) });
  }
}

export interface KnownReportResult {
  result: FileResult;
  /** 내장 점검 기준으로 대조했는가. 기준이 없는 항목은 값만 뽑았으므로 false */
  checked: boolean;
}

/**
 * 기관과 항목을 이미 아는 보고서(알리오에서 가져온 PDF)를 점검한다.
 * 기관·항목은 AI에게 묻지 않고 받은 값을 그대로 쓰며, 글자를 뽑아 값만 추출한다.
 * 점검 기준(checklist)이 있는 항목만 체크리스트와 대조하고, 없는 항목은 대조하지 않는다.
 */
export async function checkKnownReport(args: {
  fileName: string;
  bytes: Uint8Array;
  model: string;
  ai: AiClient;
  /** 알리오 기관명 */
  institution: string;
  /** 알리오 항목 이름. 예: "임원 연봉" */
  itemName: string;
  /** 내장 점검 기준이 있는 항목이면 그 항목 종류 */
  checklist?: ItemType;
}): Promise<KnownReportResult> {
  const { fileName, bytes, model, ai, institution, itemName, checklist } = args;
  if (!isAllowedModel(model)) throw new Error("허용되지 않은 AI 모델");

  const started = Date.now();
  const base = { fileName, institution, itemType: checklist ?? null, extracted: [], findings: [], model };
  const done = (partial: Partial<FileResult> & Pick<FileResult, "status">, checked = false): KnownReportResult => ({
    result: { ...base, ...partial, elapsedMs: Date.now() - started },
    checked,
  });

  const text = await extract(fileName, bytes);
  if (text.status !== "ok") return done({ status: text.status, reason: text.reason });

  try {
    const a = await analyzeKnownDocument({ units: text.units, model, ai, itemName, checklist });
    return done({ status: "ok", extracted: a.extracted, findings: a.findings, usage: a.usage }, a.checked);
  } catch (e) {
    return done({ status: "failed", reason: describeError(e) });
  }
}
