// Design Ref: DESIGN.md §2.3 — 브라우저가 파일 1개와 모델 이름을 POST /api/check 로 보내고 FileResult 를 받는다.
import type { FileResult } from "./types";

export type CheckOutcome = { ok: true; result: FileResult } | { ok: false; error: string };

/** 파일 1개를 점검 서버에 보낸다. 실패해도 던지지 않고 이유를 돌려준다(한 파일의 실패가 나머지에 영향을 주지 않게). */
export async function requestCheck(file: File, model: string): Promise<CheckOutcome> {
  const form = new FormData();
  form.set("file", file);
  form.set("model", model);
  try {
    const res = await fetch("/api/check", { method: "POST", body: form });
    const body: unknown = await res.json().catch(() => null);
    if (res.ok && body && typeof body === "object") return { ok: true, result: body as FileResult };
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `서버 오류 (${res.status})`;
    return { ok: false, error: message };
  } catch {
    return { ok: false, error: "서버에 연결할 수 없음" };
  }
}
