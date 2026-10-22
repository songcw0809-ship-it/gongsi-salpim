// Design Ref: DESIGN.md §2.1-2 — 알리오에서 기관 목록·공시번호·보고서 PDF를 가져온다.
// Plan SC: PLAN.md 9-1 — `www.alio.go.kr` 외 주소는 호출하지 않고, 요청 사이에 간격을 두고, 실패와 "보고서 없음"을 구분한다.
//
// 주의: 쓰는 주소는 알리오의 공식 API가 아니라 알리오 화면이 쓰는 주소이다(2026-10-22 직접 확인, DESIGN §5 6번).
// 알리오가 화면을 바꾸면 멈출 수 있고, 그때는 "bad-response" 오류로 알린다. 서버 코드에서만 쓴다.
import { MAX_FILE_BYTES } from "../limits.ts";
import { findFetchableItem } from "./items.ts";

/** 알리오 주소. 요청은 항상 이 주소에 경로를 붙여서만 만든다 (사용자 입력으로 주소를 바꿀 수 없다). */
export const ALIO_ORIGIN = "https://www.alio.go.kr";

export type AlioErrorCode =
  | "invalid-input" // 기관 코드·항목 번호·공시번호가 약속한 모양이 아님 (알리오를 부르지 않고 거절)
  | "network" //       알리오에 연결하지 못함
  | "timeout" //       알리오가 시간 안에 답하지 않음
  | "bad-response" //  알리오 응답이 예상과 다름 (화면이 바뀌었을 수 있음)
  | "too-large"; //    보고서 PDF가 파일 크기 한도(4MB)를 넘음

export class AlioError extends Error {
  readonly code: AlioErrorCode;
  constructor(code: AlioErrorCode, message: string) {
    super(message);
    this.name = "AlioError";
    this.code = code;
  }
}

export interface Institution {
  /** 알리오 기관 코드. 예: "C0847" */
  id: string;
  name: string;
  /** 기관 유형. 예: "기타공공기관" */
  type: string;
  /** 주무 부처. 예: "통일부" */
  ministry: string;
}

export interface Disclosure {
  disclosureNo: string;
  /** 보고서의 연도·분기. 예: "2026년 1분기". 알아내지 못하면 null */
  period: string | null;
}

export interface AlioClientOptions {
  /** 시험에서 가짜 응답을 끼워 넣을 때 쓴다. 기본은 전역 fetch */
  fetch?: typeof fetch;
  /** 알리오에 보내는 요청 사이의 최소 간격(밀리초). 기본 700 */
  minIntervalMs?: number;
  /** 요청 하나의 제한 시간(밀리초). 기본 20000 */
  timeoutMs?: number;
  /** 보고서 PDF의 최대 크기(바이트). 기본은 파일 크기 한도(4MB) */
  maxBytes?: number;
}

const APBA_ID = /^[A-Z]\d{4}$/;
const DISCLOSURE_NO = /^\d{10,20}$/;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 선택된 분기(없으면 첫 분기)를 "2026년 1분기" 모양으로 읽는다. */
function readPeriod(html: string): string | null {
  const match =
    html.match(/<option[^>]*selected[^>]*>\s*(20\d\d)년\s*(\d)분기/) ?? html.match(/<option[^>]*>\s*(20\d\d)년\s*(\d)분기/);
  return match ? `${match[1]}년 ${match[2]}분기` : null;
}

export function createAlioClient(options: AlioClientOptions = {}) {
  const doFetch = options.fetch ?? fetch;
  const minIntervalMs = options.minIntervalMs ?? 700;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxBytes = options.maxBytes ?? MAX_FILE_BYTES;

  // 요청 사이 간격: 동시에 여러 요청이 와도 순서대로 줄을 세워 간격을 지킨다.
  let lastAt = 0;
  let queue: Promise<unknown> = Promise.resolve();
  function waitTurn(): Promise<void> {
    const turn = queue.then(async () => {
      const wait = lastAt + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastAt = Date.now();
    });
    queue = turn.catch(() => undefined);
    return turn;
  }

  async function request(path: string, accept: string): Promise<Response> {
    await waitTurn();
    let res: Response;
    try {
      res = await doFetch(`${ALIO_ORIGIN}${path}`, { headers: { accept }, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "TimeoutError" || name === "AbortError") throw new AlioError("timeout", "알리오가 시간 안에 응답하지 않음");
      throw new AlioError("network", "알리오에 연결할 수 없음");
    }
    // 다른 주소로 넘겨졌으면 믿지 않는다
    if (res.url && new URL(res.url).origin !== ALIO_ORIGIN) throw new AlioError("bad-response", "알리오가 다른 주소로 넘김");
    if (!res.ok) throw new AlioError("bad-response", `알리오 응답 오류 (${res.status})`);
    return res;
  }

  return {
    /** 알리오 본부 기관 목록 (부설 기관은 뺀다). 기관명 가나다순. */
    async listInstitutions(): Promise<Institution[]> {
      const res = await request("/organ/findApbaList.json", "application/json");
      const body: unknown = await res.json().catch(() => null);
      const data = body && typeof body === "object" && "data" in body ? (body as { data: unknown }).data : null;
      if (!body || (body as { status?: unknown }).status !== "success" || !data || typeof data !== "object") {
        throw new AlioError("bad-response", "알리오 기관 목록을 읽을 수 없음");
      }
      const list: Institution[] = [];
      for (const raw of Object.values(data as Record<string, unknown>)) {
        const o = raw as Record<string, unknown> | null;
        if (!o || typeof o.apbaId !== "string" || typeof o.apbaNa !== "string" || o.subFlag !== "N") continue;
        if (!APBA_ID.test(o.apbaId)) continue;
        list.push({
          id: o.apbaId,
          name: o.apbaNa,
          type: typeof o.apbaTypeNa === "string" ? o.apbaTypeNa : "",
          ministry: typeof o.jidtDptmNa === "string" ? o.jidtDptmNa : "",
        });
      }
      if (list.length === 0) throw new AlioError("bad-response", "알리오 기관 목록이 비어 있음");
      return list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    },

    /**
     * 기관의 항목별 최신 공시번호를 찾는다. 그 기관에 해당 보고서가 없으면 null (오류가 아니다).
     * 가져올 수 있는 항목("정기 · 보고서")의 번호만 받는다.
     */
    async findDisclosure(apbaId: string, formNo: string): Promise<Disclosure | null> {
      if (!APBA_ID.test(apbaId)) throw new AlioError("invalid-input", "기관 코드가 올바르지 않음");
      if (!findFetchableItem(formNo)) throw new AlioError("invalid-input", "가져올 수 없는 공시 항목");
      const res = await request(
        `/item/itemReportTerm.do?apbaId=${apbaId}&reportFormRootNo=${encodeURIComponent(formNo)}&disclosureNo=`,
        "text/html",
      );
      const html = await res.text();
      const marker = html.match(/disclosureNo:"(\d*)"/);
      // 표식이 아예 없으면 화면이 바뀐 것이고, 값이 비어 있으면 그 기관에 보고서가 없는 것이다.
      if (!marker) throw new AlioError("bad-response", "알리오 항목 화면에서 공시번호를 찾을 수 없음");
      if (marker[1] === "") return null;
      return { disclosureNo: marker[1], period: readPeriod(html) };
    },

    /** 공시번호의 보고서 PDF를 받는다. PDF가 아니거나 4MB를 넘으면 오류. */
    async downloadReport(disclosureNo: string): Promise<Uint8Array> {
      if (!DISCLOSURE_NO.test(disclosureNo)) throw new AlioError("invalid-input", "공시번호가 올바르지 않음");
      const res = await request(`/download/pdf.json?disclosureNo=${disclosureNo}`, "application/pdf");
      if (!(res.headers.get("content-type") ?? "").includes("application/pdf")) {
        throw new AlioError("bad-response", "알리오가 PDF가 아닌 응답을 돌려줌");
      }
      const declared = Number(res.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > maxBytes) throw new AlioError("too-large", "보고서가 파일 크기 한도를 넘음");
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > maxBytes) throw new AlioError("too-large", "보고서가 파일 크기 한도를 넘음");
      const magic = new TextDecoder().decode(bytes.slice(0, 5));
      if (bytes.length === 0 || magic !== "%PDF-") throw new AlioError("bad-response", "알리오가 올바른 PDF를 주지 않음");
      return bytes;
    },
  };
}

export type AlioClient = ReturnType<typeof createAlioClient>;
