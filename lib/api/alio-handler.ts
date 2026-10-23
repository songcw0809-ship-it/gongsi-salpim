// Design Ref: DESIGN.md §2.1-2, §2.3 — 알리오 가져오기 접수 창구.
// Plan SC: PLAN.md 9-2 — 기관 목록 API, "기관 1곳 × 항목 1종을 가져와 점검" API, 허용된 AI 모델만 받기,
//          점검 기준이 없는 항목은 AI 대조를 건너뛰고 "점검 기준 준비 중"으로 돌려주기.
//
// GET  /api/alio/institutions   알리오 본부 기관 목록과 조회 칸 선택지
// POST /api/alio/check          JSON { apbaId, formNo, model }  → 기관 1곳 × 항목 1종을 가져와 점검
//
// 한 요청은 기관 1곳 × 항목 1종이다. 여러 건은 브라우저가 건마다 이 주소를 불러서 처리하므로 한 건이 실패해도 나머지는 계속된다.
// 알리오에서 가져오지 못하거나 보고서가 없는 경우는 오류(4xx·5xx)가 아니라 outcome 으로 알리고 HTTP 200 을 돌려준다.
import { createOpenAiClientFromEnv } from "../ai/openai.ts";
import type { AiClient } from "../ai/analyze.ts";
import { resolveModel } from "../ai/models.ts";
import { AlioError, createAlioClient } from "../alio/client.ts";
import type { AlioClient, Institution } from "../alio/client.ts";
import { filterChoices } from "../alio/filter.ts";
import { findFetchableItem } from "../alio/items.ts";
import type { AlioCheckResponse, AlioInstitutionsResponse } from "../alio/api-types.ts";
import { checkKnownReport } from "../check-file.ts";
import { ALIO_MAX_INSTITUTIONS, ALIO_MAX_REQUESTS, ALIO_RATE_LIMIT } from "../limits.ts";
import { isSameOrigin } from "./origin.ts";
import { createRateLimiter } from "./rate-limit.ts";
import type { RateLimiter } from "./rate-limit.ts";

const fail = (status: number, error: string, headers?: HeadersInit) => Response.json({ error }, { status, headers });

/** 기관 목록은 자주 바뀌지 않으므로 서버 메모리에 잠시 둔다 (알리오 부담을 줄인다) */
const LIST_TTL_MS = 60 * 60 * 1000;

export interface AlioHandlerDeps {
  alio?: AlioClient;
  getAi?: () => AiClient;
  limiter?: RateLimiter;
  now?: () => number;
}

export function createAlioHandlers(deps: AlioHandlerDeps = {}) {
  const alio = deps.alio ?? createAlioClient();
  const getAi = deps.getAi ?? createOpenAiClientFromEnv;
  const limiter = deps.limiter ?? createRateLimiter(ALIO_RATE_LIMIT.max, ALIO_RATE_LIMIT.windowMs);
  const now = deps.now ?? Date.now;

  let cache: { at: number; list: Institution[] } | null = null;
  async function institutions(): Promise<Institution[]> {
    if (cache && now() - cache.at < LIST_TTL_MS) return cache.list;
    const list = await alio.listInstitutions();
    cache = { at: now(), list };
    return list;
  }

  return {
    async handleInstitutions(): Promise<Response> {
      try {
        const list = await institutions();
        const body: AlioInstitutionsResponse = {
          institutions: list,
          filters: filterChoices(list),
          limits: { maxInstitutions: ALIO_MAX_INSTITUTIONS, maxRequests: ALIO_MAX_REQUESTS },
        };
        return Response.json(body);
      } catch (e) {
        return fail(502, e instanceof AlioError ? `알리오 기관 목록을 가져오지 못함: ${e.message}` : "알리오 기관 목록을 가져오지 못함");
      }
    },

    async handleCheck(request: Request): Promise<Response> {
      // 0. 다른 사이트에서 보낸 요청은 거절한다
      if (!isSameOrigin(request)) return fail(403, "허용되지 않은 요청 출처");
      // 1. 요청 모양
      if (!request.headers.get("content-type")?.includes("application/json")) return fail(415, "요청은 JSON으로 보내야 함");
      const body: unknown = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return fail(400, "요청을 읽을 수 없음");
      const { apbaId, formNo, model: requested } = body as Record<string, unknown>;

      // 2. 모델·항목: 허용 목록에 있는 것만. 알리오와 AI를 부르기 전에 거른다.
      const model = resolveModel(requested);
      if (!model) return fail(400, "허용되지 않은 AI 모델");
      const item = findFetchableItem(formNo);
      if (!item || item.formNo === null) return fail(400, "가져올 수 없는 공시 항목");
      if (typeof apbaId !== "string" || !/^[A-Z]\d{4}$/.test(apbaId)) return fail(400, "기관 코드가 올바르지 않음");

      // 3. 짧은 시간 안의 요청 수 제한 (비용 방어선)
      const turn = limiter.take(now());
      if (!turn.ok) {
        return fail(429, "요청이 너무 많음. 잠시 뒤 다시 시도해 주세요", { "retry-after": String(turn.retryAfterSeconds) });
      }

      // 4. AI 연결. 키가 없으면 알리오를 부르기 전에 알린다. 설정 내용은 밖으로 알리지 않는다.
      let ai: AiClient;
      try {
        ai = getAi();
      } catch {
        return fail(500, "서버 설정 문제로 점검할 수 없음");
      }

      const itemInfo = { no: item.no, name: item.name, formNo: item.formNo, hasChecklist: Boolean(item.checklist) };
      const respond = (r: Omit<AlioCheckResponse, "item">) => Response.json({ ...r, item: itemInfo } satisfies AlioCheckResponse);

      // 5. 기관: 알리오 기관 목록에 있는 코드만 받는다
      let institution: Institution | undefined;
      try {
        institution = (await institutions()).find((i) => i.id === apbaId);
      } catch (e) {
        return respond({
          outcome: "fetch-failed",
          institution: { id: apbaId, name: apbaId },
          period: null,
          reason: e instanceof AlioError ? e.message : "알리오 기관 목록을 가져오지 못함",
        });
      }
      if (!institution) return fail(400, "알리오 기관 목록에 없는 기관");
      const who = { id: institution.id, name: institution.name };

      // 6. 알리오에서 가져오기
      let period: string | null = null;
      let disclosureNo: string | undefined;
      let bytes: Uint8Array;
      try {
        const disclosure = await alio.findDisclosure(institution.id, item.formNo);
        if (!disclosure) return respond({ outcome: "not-found", institution: who, period: null });
        period = disclosure.period;
        disclosureNo = disclosure.disclosureNo;
        bytes = await alio.downloadReport(disclosure.disclosureNo);
      } catch (e) {
        return respond({
          outcome: "fetch-failed",
          institution: who,
          period,
          disclosureNo,
          reason: e instanceof AlioError ? e.message : "알리오에서 가져오는 중 오류가 났습니다",
        });
      }

      // 7. 점검: 기관·항목은 확정, 값 추출 + (점검 기준이 있는 항목만) 체크리스트 대조
      const fileName = `${institution.name}_${item.name}.pdf`.slice(-200);
      const { result, checked } = await checkKnownReport({
        fileName,
        bytes,
        model,
        ai,
        institution: institution.name,
        itemName: item.name,
        checklist: item.checklist,
      });
      if (result.status !== "ok") return respond({ outcome: "check-failed", institution: who, period, disclosureNo, result });
      return respond({ outcome: checked ? "checked" : "extracted-only", institution: who, period, disclosureNo, result });
    },
  };
}

export type AlioHandlers = ReturnType<typeof createAlioHandlers>;
