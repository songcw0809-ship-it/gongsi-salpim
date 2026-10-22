// Design Ref: DESIGN.md §2.3 — 브라우저가 알리오 가져오기 API(/api/alio/…)를 부르는 부분.
import type { AlioCheckResponse, AlioInstitutionsResponse } from "./api-types.ts";

export type Outcome<T> = { ok: true; data: T } | { ok: false; error: string };

async function readError(res: Response): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error;
  return `서버 오류 (${res.status})`;
}

/** 알리오 기관 목록과 조회 선택지를 가져온다. 실패해도 던지지 않고 이유를 돌려준다. */
export async function fetchInstitutions(): Promise<Outcome<AlioInstitutionsResponse>> {
  try {
    const res = await fetch("/api/alio/institutions");
    if (!res.ok) return { ok: false, error: await readError(res) };
    return { ok: true, data: (await res.json()) as AlioInstitutionsResponse };
  } catch {
    return { ok: false, error: "서버에 연결할 수 없음" };
  }
}

/** 기관 1곳 × 항목 1종을 알리오에서 가져와 점검한다. 실패해도 던지지 않고 이유를 돌려준다. */
export async function requestAlioCheck(apbaId: string, formNo: string, model: string): Promise<Outcome<AlioCheckResponse>> {
  try {
    const res = await fetch("/api/alio/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apbaId, formNo, model }),
    });
    if (!res.ok) return { ok: false, error: await readError(res) };
    return { ok: true, data: (await res.json()) as AlioCheckResponse };
  } catch {
    return { ok: false, error: "서버에 연결할 수 없음" };
  }
}
