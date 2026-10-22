// 알리오 가져오기 API(lib/api/alio-handler.ts, app/api/alio/…)가 PRD·DESIGN 규칙대로 답하는지 확인한다.
//
// 실행:  node scripts/check_alio_api.mjs
// 가짜 알리오와 가짜 AI로 시험한다 (알리오·AI를 부르지 않음). 보고서 대신 samples/ 의 실제 PDF를 써서 글자 뽑기까지 진짜로 돌린다.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AlioError } from "../lib/alio/client.ts";
import { createAlioHandlers } from "../lib/api/alio-handler.ts";
import { createRateLimiter } from "../lib/api/rate-limit.ts";
import { ALIO_MAX_INSTITUTIONS, ALIO_MAX_REQUESTS } from "../lib/limits.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE = new Uint8Array(readFileSync(join(ROOT, "samples", "가온에너지공단_임원연봉.pdf")));
const SCAN = new Uint8Array(readFileSync(join(ROOT, "samples", "exceptions", "스캔본_임원연봉.pdf")));

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const LIST = [
  { id: "C0847", name: "(사)남북교류협력지원협회", type: "기타공공기관", ministry: "통일부" },
  { id: "A1001", name: "가온공사", type: "공기업(시장형)", ministry: "재정경제부" },
];

/** 부른 횟수를 세는 가짜 알리오 */
function fakeAlio(o = {}) {
  const calls = { list: 0, find: [], download: [] };
  return {
    calls,
    async listInstitutions() {
      calls.list++;
      if (o.listError) throw o.listError;
      return LIST;
    },
    async findDisclosure(apbaId, formNo) {
      calls.find.push(`${apbaId}/${formNo}`);
      if (o.findError) throw o.findError;
      return o.notFound ? null : { disclosureNo: "2026041303148851", period: "2026년 1분기" };
    },
    async downloadReport(no) {
      calls.download.push(no);
      if (o.downloadError) throw o.downloadError;
      return o.bytes ?? SAMPLE;
    },
  };
}

/** 부른 횟수와 모델을 기록하는 가짜 AI. 값 추출에는 문서에 실제로 있는 문구를, 대조에는 R10-1 지적 1건을 답한다. */
function fakeAi(o = {}) {
  const calls = [];
  return {
    calls,
    async json(req) {
      calls.push({ name: req.schemaName, model: req.model });
      if (o.fail) {
        const e = new Error("내부 오류 sk-비밀키");
        e.status = 500;
        throw e;
      }
      const usage = { inputTokens: 10, outputTokens: 5 };
      if (req.schemaName === "extract_values") {
        return { data: { extracted: [{ label: "표 제목", value: "임원 보수 현황", location: "1쪽" }, { label: "없는 값", value: "지어낸 값 99999", location: "1쪽" }] }, usage };
      }
      return { data: { findings: [{ ruleId: "R10-1", message: "기본급 항목이 없는 것으로 보입니다.", confidence: "높음", quote: "임원 보수 현황", location: "1쪽" }] }, usage };
    },
  };
}

const post = (body, { raw, type = "application/json" } = {}) =>
  new Request("http://localhost/api/alio/check", { method: "POST", headers: { "content-type": type }, body: raw ?? JSON.stringify(body) });
const handlers = (alio, ai, extra = {}) => createAlioHandlers({ alio, getAi: () => ai, ...extra });
const run = async (h, body, opts) => {
  const res = await h.handleCheck(post(body, opts));
  return { res, body: await res.json() };
};

console.log("== 1. 기관 목록 GET /api/alio/institutions");
{
  let t = 0;
  const alio = fakeAlio();
  const h = handlers(alio, fakeAi(), { now: () => t });
  const res = await h.handleInstitutions();
  const body = await res.json();
  check(res.status === 200 && body.institutions.length === 2, "기관 목록을 돌려줌", `${body.institutions.length}곳`);
  check(body.filters.types.join() === "공기업(시장형),기타공공기관" && body.filters.ministries.join() === "재정경제부,통일부", "조회 칸에 보일 기관 유형·주무 부처 선택지가 함께 나옴");
  check(body.limits.maxInstitutions === ALIO_MAX_INSTITUTIONS && body.limits.maxRequests === ALIO_MAX_REQUESTS && ALIO_MAX_INSTITUTIONS === 10 && ALIO_MAX_REQUESTS === 20, "화면이 지킬 상한(기관 10곳·20건)을 함께 알려 줌");
  await h.handleInstitutions();
  check(alio.calls.list === 1, "두 번째 요청은 알리오를 다시 부르지 않고 저장해 둔 목록을 씀");
  t += 61 * 60 * 1000;
  await h.handleInstitutions();
  check(alio.calls.list === 2, "1시간이 지나면 알리오에서 다시 받음");
  const bad = await handlers(fakeAlio({ listError: new AlioError("network", "알리오에 연결할 수 없음") }), fakeAi()).handleInstitutions();
  check(bad.status === 502 && (await bad.json()).error.includes("알리오에 연결할 수 없음"), "알리오에서 못 받으면 502와 이유");
}

console.log("\n== 2. 요청이 잘못된 경우 (알리오·AI를 부르지 않음)");
{
  const alio = fakeAlio();
  const ai = fakeAi();
  const h = handlers(alio, ai);
  const ok = { apbaId: "C0847", formNo: "2050", model: "gpt-6.1-sol" };
  const cases = [
    ["JSON이 아닌 요청", await run(h, null, { raw: "x=1", type: "text/plain" }), 415],
    ["깨진 JSON", await run(h, null, { raw: "{" }), 400],
    ["허용되지 않은 모델", await run(h, { ...ok, model: "gpt-4" }), 400],
    ["수시 보고서 항목 번호", await run(h, { ...ok, formNo: "10105" }), 400],
    ["게시판 항목 번호", await run(h, { ...ok, formNo: "B1010" }), 400],
    ["숫자로 보낸 항목 번호", await run(h, { ...ok, formNo: 2050 }), 400],
    ["이상한 기관 코드", await run(h, { ...ok, apbaId: "../x" }), 400],
    ["기관 코드 없음", await run(h, { formNo: "2050" }), 400],
  ];
  for (const [label, r, status] of cases) check(r.res.status === status, `${label} → ${status}`, r.body.error);
  check(alio.calls.list === 0 && alio.calls.find.length === 0 && ai.calls.length === 0, "거절한 요청은 알리오도 AI도 한 번도 부르지 않음");

  const unknown = await run(h, { ...ok, apbaId: "Z9999" });
  check(unknown.res.status === 400 && unknown.body.error === "알리오 기관 목록에 없는 기관" && alio.calls.find.length === 0 && ai.calls.length === 0, "알리오 기관 목록에 없는 코드는 400, 보고서를 가져오지 않음");
}

console.log("\n== 3. 점검 기준이 있는 항목(임원 연봉): 가져와서 값 추출 + 체크리스트 대조");
{
  const alio = fakeAlio();
  const ai = fakeAi();
  const { res, body } = await run(handlers(alio, ai), { apbaId: "C0847", formNo: "2050", model: "gpt-6-luna" });
  check(res.status === 200 && body.outcome === "checked", "outcome = checked", body.outcome);
  check(body.institution.id === "C0847" && body.institution.name === "(사)남북교류협력지원협회" && body.item.no === "10" && body.item.hasChecklist === true && body.period === "2026년 1분기", "기관·항목·분기가 함께 나옴", `${body.institution.name} / ${body.item.name} / ${body.period}`);
  check(body.result.status === "ok" && body.result.institution === "(사)남북교류협력지원협회" && body.result.itemType === "임원연봉", "기관은 알리오 목록으로, 항목 종류는 점검 기준 항목으로 확정됨 (AI가 추측하지 않음)");
  check(ai.calls.map((c) => c.name).join() === "extract_values,check_findings", "AI는 값 추출과 대조만 부름 (분류 호출 없음)", ai.calls.map((c) => c.name).join());
  check(ai.calls.every((c) => c.model === "gpt-6-luna"), "고른 모델로만 점검함");
  check(body.result.findings.length === 1 && body.result.findings[0].ruleId === "R10-1", "검증 장치를 통과한 지적이 나옴");
  check(body.result.extracted.find((x) => x.label === "표 제목")?.value === "임원 보수 현황" && body.result.extracted.find((x) => x.label === "없는 값")?.value === "추출 불가", "문서에 없는 값은 '추출 불가'로 바뀜");
  check(alio.calls.find.join() === "C0847/2050" && alio.calls.download.join() === "2026041303148851", "알리오에는 기관 코드·항목 번호로 조회하고 받은 공시번호로 내려받음");
  check(body.result.model === "gpt-6-luna" && body.result.usage?.inputTokens === 20, "결과에 모델과 토큰 사용량이 남음");
}

console.log("\n== 4. 점검 기준이 없는 항목(임직원 수): 값만 뽑고 AI 대조는 하지 않음");
{
  const ai = fakeAi();
  const { body } = await run(handlers(fakeAlio(), ai), { apbaId: "C0847", formNo: "2020", model: "gpt-6.1-sol" });
  check(body.outcome === "extracted-only" && body.item.hasChecklist === false, "outcome = extracted-only (점검 기준 준비 중)", body.outcome);
  check(ai.calls.map((c) => c.name).join() === "extract_values", "AI는 값 추출 한 번만 부름 (체크리스트 대조 없음)", ai.calls.map((c) => c.name).join());
  check(body.result.findings.length === 0 && body.result.itemType === null && body.result.extracted.length === 2, "지적은 없고 값은 뽑혀 있으며, 항목 종류는 null(점검 기준 항목이 아님)");
}

console.log("\n== 5. 해당 보고서가 없는 기관");
{
  const alio = fakeAlio({ notFound: true });
  const ai = fakeAi();
  const { res, body } = await run(handlers(alio, ai), { apbaId: "C0847", formNo: "2130", model: "gpt-6.1-sol" });
  check(res.status === 200 && body.outcome === "not-found" && !body.result, "outcome = not-found, HTTP 200, 결과 없음 (오류가 아님)");
  check(alio.calls.download.length === 0 && ai.calls.length === 0, "보고서가 없으면 내려받기도 AI도 부르지 않음");
  check(!JSON.stringify(body).includes("미제출"), "'미제출'이라고 단정하지 않음");
}

console.log("\n== 6. 알리오에서 가져오지 못한 경우: 그 건만 fetch-failed (HTTP 200)");
{
  for (const [label, o, text] of [
    ["연결 실패", { findError: new AlioError("network", "알리오에 연결할 수 없음") }, "알리오에 연결할 수 없음"],
    ["시간 초과", { downloadError: new AlioError("timeout", "알리오가 시간 안에 응답하지 않음") }, "시간 안에"],
    ["화면 변경", { findError: new AlioError("bad-response", "알리오 항목 화면에서 공시번호를 찾을 수 없음") }, "공시번호를 찾을 수 없음"],
    ["4MB 초과", { downloadError: new AlioError("too-large", "보고서가 파일 크기 한도를 넘음") }, "한도를 넘음"],
  ]) {
    const ai = fakeAi();
    const { res, body } = await run(handlers(fakeAlio(o), ai), { apbaId: "C0847", formNo: "2050", model: "gpt-6.1-sol" });
    check(res.status === 200 && body.outcome === "fetch-failed" && body.reason.includes(text) && ai.calls.length === 0, `${label} → fetch-failed + 이유, AI 호출 없음`, body.reason);
  }
  const listDown = await run(handlers(fakeAlio({ listError: new AlioError("network", "알리오에 연결할 수 없음") }), fakeAi()), { apbaId: "C0847", formNo: "2050", model: "gpt-6.1-sol" });
  check(listDown.body.outcome === "fetch-failed", "기관 목록을 못 받아도 fetch-failed 로 알림");
}

console.log("\n== 7. 가져왔지만 점검하지 못한 경우: check-failed");
{
  const ai = fakeAi();
  const scan = await run(handlers(fakeAlio({ bytes: SCAN }), ai), { apbaId: "C0847", formNo: "2050", model: "gpt-6.1-sol" });
  check(scan.body.outcome === "check-failed" && scan.body.result.status === "unreadable" && ai.calls.length === 0, "스캔본: check-failed(글자를 읽을 수 없음), AI 호출 없음", scan.body.result.reason);
  const broken = await run(handlers(fakeAlio({ bytes: new Uint8Array([1, 2, 3]) }), fakeAi()), { apbaId: "C0847", formNo: "2050", model: "gpt-6.1-sol" });
  check(broken.body.outcome === "check-failed" && broken.body.result.status === "failed", "손상된 PDF: check-failed");
  const aiFail = await run(handlers(fakeAlio(), fakeAi({ fail: true })), { apbaId: "C0847", formNo: "2050", model: "gpt-6.1-sol" });
  check(aiFail.res.status === 200 && aiFail.body.outcome === "check-failed" && aiFail.body.result.reason === "AI 호출 실패 (500)", "AI 호출 실패: check-failed + 일반적인 이유", aiFail.body.result.reason);
  check(!JSON.stringify(aiFail.body).includes("sk-"), "내부 오류 문구가 응답으로 새지 않음");
}

console.log("\n== 8. 서버 설정 문제와 요청 수 제한");
{
  const alio = fakeAlio();
  const noKey = createAlioHandlers({ alio, getAi: () => { throw new Error("OPENAI_API_KEY가 없음"); } });
  const r = await run(noKey, { apbaId: "C0847", formNo: "2050", model: "gpt-6.1-sol" });
  check(r.res.status === 500 && r.body.error === "서버 설정 문제로 점검할 수 없음" && !JSON.stringify(r.body).includes("OPENAI"), "AI 키가 없으면 500, 설정 이름은 숨김");
  check(alio.calls.find.length === 0, "키가 없으면 알리오를 부르기 전에 멈춤");

  const limiter = createRateLimiter(2, 60_000);
  const h = handlers(fakeAlio(), fakeAi(), { limiter });
  const ok = { apbaId: "C0847", formNo: "2050", model: "gpt-6.1-sol" };
  await run(h, ok);
  await run(h, { ...ok, model: "gpt-4" }); // 잘못된 요청은 한도를 쓰지 않는다
  await run(h, ok);
  const third = await run(h, ok);
  check(third.res.status === 429 && Number(third.res.headers.get("retry-after")) >= 1, "정해진 수를 넘으면 429와 다시 시도할 시간", `retry-after ${third.res.headers.get("retry-after")}초`);
  const t = createRateLimiter(1, 1000);
  check(t.take(0).ok && !t.take(500).ok && t.take(1001).ok, "시간이 지나면 다시 받아 줌");
}

console.log("\n== 9. 라우트 설정");
{
  const src = (p) => readFileSync(join(ROOT, "app", "api", "alio", p, "route.ts"), "utf-8");
  const c = src("check");
  const i = src("institutions");
  check(c.includes("export const maxDuration = 120;") && /export async function POST\(/.test(c) && !/export (async )?function (GET|PUT|DELETE|PATCH)/.test(c), "점검 주소는 POST만 열려 있고 제한 시간 120초");
  check(/export async function GET\(/.test(i) && !/export (async )?function (POST|PUT|DELETE|PATCH)/.test(i) && i.includes("connection()"), "기관 목록 주소는 GET만 열려 있고 요청 시점에 실행됨");
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
