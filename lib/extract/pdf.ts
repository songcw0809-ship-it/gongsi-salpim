// Design Ref: DESIGN.md §2.2 ② — PDF는 쪽별로 글자를 꺼내야 원문 위치(몇 쪽)를 알려 줄 수 있다.
// Plan SC: PLAN.md 3번 — 스캔본은 짐작하지 않고 "글자를 읽을 수 없음"으로 처리한다.
import { extractText, getDocumentProxy } from "unpdf";
import type { ExtractResult } from "../types";

/**
 * 스캔본 판정 기준: 공백을 뺀 글자 수가 전체 합쳐서 이 값보다 적으면 글자를 읽을 수 없는 파일로 본다.
 * 정상 샘플은 300자 이상, 스캔본 샘플은 0자이다. 너무 높이면 정상 파일이 처리 불가가 된다.
 */
export const MIN_TEXT_CHARS = 50;

/** 쪽수 상한. 정상 공시 보고서는 이보다 훨씬 짧다. 너무 긴 파일을 전부 읽다가 서버가 멈추는 것을 막는다 */
export const MAX_PDF_PAGES = 100;

export async function extractPdf(data: Uint8Array): Promise<ExtractResult> {
  try {
    // pdf.js가 넘겨받은 버퍼를 비우므로 복사본을 쓴다.
    const pdf = await getDocumentProxy(new Uint8Array(data));
    if (pdf.numPages > MAX_PDF_PAGES) {
      return { status: "failed", reason: `PDF가 ${MAX_PDF_PAGES}쪽을 넘어 점검할 수 없음` };
    }
    const { text } = await extractText(pdf, { mergePages: false });

    const units = text.map((t, i) => ({ location: `${i + 1}쪽`, text: t.trim() }));
    const chars = units.reduce((n, u) => n + u.text.replace(/\s/g, "").length, 0);
    if (chars < MIN_TEXT_CHARS) {
      return { status: "unreadable", reason: "글자를 읽을 수 없음" };
    }
    return { status: "ok", units };
  } catch {
    return { status: "failed", reason: "PDF를 읽을 수 없음 (파일이 손상되었거나 형식이 올바르지 않을 수 있음)" };
  }
}
