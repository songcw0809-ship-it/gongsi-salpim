// 알리오 선택 화면이 쓰는 로직(lib/alio/selection.ts, check-client.ts, 결과 표·요약의 알리오 처리)을 확인한다.
//
// 실행:  node scripts/check_alio_select.mjs
// AI·알리오·화면 없이 시험한다.

import { fetchInstitutions, requestAlioCheck } from "../lib/alio/check-client.ts";
import { canAddInstitution, canAddItem, expandRequests, requestCount, startBlockReason } from "../lib/alio/selection.ts";
import { buildResultRows } from "../lib/result-view.ts";
import { buildSummary, uncheckedCount } from "../lib/summary-view.ts";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

console.log("== 1. 선택 한도: 기관 최대 10곳, 기관×항목 최대 20건");
{
  check(requestCount({ institutions: 3, items: 4 }) === 12, "가져올 건 수 = 기관 수 × 항목 수");
  check(canAddInstitution({ institutions: 9, items: 1 }).ok, "기관 9곳 → 10번째 기관을 고를 수 있음");
  const tenth = canAddInstitution({ institutions: 10, items: 1 });
  check(!tenth.ok && tenth.reason.includes("최대 10곳"), "기관 10곳 → 11번째는 못 고르고 이유를 알림", tenth.reason);
  check(canAddInstitution({ institutions: 9, items: 2 }).ok, "기관 9곳 × 항목 2개 → 10번째 기관을 고르면 정확히 20건이라 고를 수 있음");
  check(!canAddInstitution({ institutions: 9, items: 3 }).ok && canAddInstitution({ institutions: 9, items: 3 }).reason.includes("20건"), "기관 9곳 × 항목 3개 → 기관을 더 고르면 30건이라 못 고르고 20건 한도를 이유로 알림 (10곳이 안 돼도 20건이 먼저 막음)");
  check(canAddInstitution({ institutions: 5, items: 2 }).ok, "기관 5곳 × 항목 2개 → 기관을 더 고르는 건 가능 (12건)");
  check(canAddItem({ institutions: 10, items: 1 }).ok && !canAddItem({ institutions: 10, items: 2 }).ok, "기관 10곳 × 항목 1개 → 2번째 항목은 20건이라 가능, 기관 10곳 × 항목 2개 → 3번째 항목은 30건이라 못 고름");
  check(canAddItem({ institutions: 0, items: 19 }).ok, "기관을 아직 안 골랐으면 항목은 마음대로 고를 수 있음");
  check(canAddInstitution({ institutions: 0, items: 30 }).ok === false, "항목을 30개 골라 둔 상태에서 첫 기관을 고르면 30건이라 못 고름 (항목부터 많이 골랐을 때도 20건을 지킴)");
  check(startBlockReason({ institutions: 0, items: 0 }) === "공시 항목을 하나 이상 고르세요", "항목이 없으면 시작할 수 없음");
  check(startBlockReason({ institutions: 0, items: 1 }) === "기관을 하나 이상 고르세요", "기관이 없으면 시작할 수 없음");
  check(startBlockReason({ institutions: 10, items: 2 }) === null, "기관 10곳 × 항목 2개 = 20건은 시작할 수 있음");
  check(startBlockReason({ institutions: 10, items: 3 })?.includes("20건") && startBlockReason({ institutions: 11, items: 1 })?.includes("10곳"), "한도를 넘으면 시작할 수 없음");
  const reqs = expandRequests(["가", "나"], [1, 2, 3]);
  check(reqs.length === 6 && reqs[0].institution === "가" && reqs[2].item === 3 && reqs[3].institution === "나", "기관 순서대로, 기관마다 항목 순서대로 펼침");
}

console.log("\n== 2. 서버 호출 (fetch를 가짜로 바꿔 시험)");
{
  const real = globalThis.fetch;
  const seen = [];
  const fake = (res) => async (url, init) => {
    seen.push({ url: String(url), method: init?.method, body: init?.body });
    return res();
  };

  globalThis.fetch = fake(() => Response.json({ institutions: [], filters: { types: [], ministries: [] }, limits: { maxInstitutions: 10, maxRequests: 20 } }));
  const list = await fetchInstitutions();
  check(list.ok && seen[0].url === "/api/alio/institutions", "기관 목록을 /api/alio/institutions 에서 받음");

  globalThis.fetch = fake(() => Response.json({ error: "알리오 기관 목록을 가져오지 못함: 알리오에 연결할 수 없음" }, { status: 502 }));
  const bad = await fetchInstitutions();
  check(!bad.ok && bad.error.includes("알리오에 연결할 수 없음"), "서버가 502를 알리면 그 이유를 돌려줌", bad.error);

  globalThis.fetch = fake(() => Response.json({ outcome: "checked", institution: { id: "C0847", name: "x" }, item: { no: "10", name: "임원 연봉", formNo: "2050", hasChecklist: true }, period: "2026년 1분기" }));
  const ok = await requestAlioCheck("C0847", "2050", "gpt-6-luna");
  const sent = JSON.parse(seen.at(-1).body);
  check(ok.ok && ok.data.outcome === "checked", "점검 결과를 받음");
  check(seen.at(-1).url === "/api/alio/check" && seen.at(-1).method === "POST" && sent.apbaId === "C0847" && sent.formNo === "2050" && sent.model === "gpt-6-luna", "POST /api/alio/check 로 기관 코드·항목 번호·모델을 JSON으로 보냄");

  globalThis.fetch = fake(() => Response.json({ error: "요청이 너무 많음. 잠시 뒤 다시 시도해 주세요" }, { status: 429 }));
  const many = await requestAlioCheck("C0847", "2050", "gpt-6-luna");
  check(!many.ok && many.error.includes("너무 많음"), "429이면 이유를 돌려줌");

  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  const down = await requestAlioCheck("C0847", "2050", "gpt-6-luna");
  check(!down.ok && down.error === "서버에 연결할 수 없음", "서버에 연결되지 않아도 던지지 않고 이유를 돌려줌");
  globalThis.fetch = real;
}

const finding = (confidence = "높음") => ({ ruleId: "R10-1", message: "오류 가능성: 시험용", confidence, evidence: { quote: "임원 보수 현황", location: "3쪽" } });
const result = (institution, itemType, findings = [], extra = {}) => ({
  fileName: "x", status: "ok", institution, itemType, extracted: [{ label: "기본급", value: "100", location: "1쪽" }], findings, elapsedMs: 1, model: "gpt-6.1-sol", ...extra,
});
const alioRow = (id, institution, itemName, outcome, o = {}) => ({
  id, fileName: `${institution} · ${itemName}`, phase: outcome === "fetch-failed" || outcome === "request-failed" ? "error" : "done",
  alio: { institutionName: institution, itemName, period: "2026년 1분기", outcome }, ...o,
});
const row = (rows, id) => rows.find((r) => r.id === id);

console.log("\n== 3. 알리오 결과가 결과 표에 보이는 모양");
{
  const rows = buildResultRows([
    alioRow(1, "남북협회", "임원 연봉", "checked", { result: result("남북협회", "임원연봉", [finding(), finding("중간")]) }),
    alioRow(2, "남북협회", "임직원 수", "extracted-only", { result: result("남북협회", null) }),
    alioRow(3, "남북협회", "소송 및 소송대리인 현황", "not-found"),
    alioRow(4, "남북협회", "직원 평균보수", "fetch-failed", { reason: "알리오에 연결할 수 없음" }),
    alioRow(5, "남북협회", "요약 재무상태표", "request-failed", { reason: "서버에 연결할 수 없음" }),
    alioRow(6, "예술센터", "임원 연봉", "check-failed", { result: result("예술센터", "임원연봉", [], { status: "unreadable", reason: "글자를 읽을 수 없음", extracted: [] }) }),
    { id: 7, fileName: "예술센터 · 임직원 수", phase: "running", alio: { institutionName: "예술센터", itemName: "임직원 수", period: null, outcome: "request-failed" } },
  ]);
  const a = row(rows, 1);
  check(a.state === "ready" && a.institution === "남북협회" && a.itemType === "임원 연봉" && a.note.startsWith("2026년 1분기 보고서"), "점검까지 한 항목: 기관·항목 이름과 분기, 의심 항목 수가 나옴", a.note);
  const b = row(rows, 2);
  check(b.state === "unchecked" && b.stateLabel === "점검 기준 준비 중" && b.extracted.length === 1 && b.note.includes("AI 대조를 하지 않았습니다") && !b.note.includes("발견된 의심 항목 없음"), "점검 기준이 없는 항목: '점검 기준 준비 중', 값은 보이고 '의심 항목 없음'이라 쓰지 않음", b.note);
  check(!b.canRetry && !b.canChoose, "이 줄에는 다시 시도·고르기가 없음");
  const c = row(rows, 3);
  check(c.state === "not-found" && c.stateLabel === "보고서 없음" && c.note.includes("제출하지 않았다는 뜻은 아닙니다") && c.extracted.length === 0, "보고서가 없으면 '보고서 없음'이라 하고 제출하지 않았다고 단정하지 않음");
  const d = row(rows, 4);
  check(d.state === "failed" && d.canRetry && d.institution === "남북협회" && d.itemType === "직원 평균보수" && d.note === "알리오에 연결할 수 없음", "알리오에서 못 가져온 건: 점검 실패 + 다시 시도, 기관·항목 이름은 그대로 보임", d.note);
  check(row(rows, 5).canRetry && row(rows, 5).note === "서버에 연결할 수 없음", "서버에 연결하지 못한 건도 다시 시도 가능");
  check(row(rows, 6).state === "unreadable" && row(rows, 6).stateLabel === "처리 불가" && !row(rows, 6).canRetry, "가져왔지만 스캔본이면 처리 불가");
  check(row(rows, 7).stateLabel === "점검 중" && row(rows, 7).institution === "예술센터" && row(rows, 7).itemType === "임직원 수", "점검 중인 건도 기관·항목 이름이 보임");
}

console.log("\n== 4. 알리오 결과의 기관별 요약");
{
  const inputs = [
    alioRow(1, "남북협회", "임원 연봉", "checked", { result: result("남북협회", "임원연봉", [finding(), finding()]) }),
    alioRow(2, "남북협회", "임직원 수", "extracted-only", { result: result("남북협회", null) }),
    alioRow(3, "예술센터", "임원 연봉", "not-found"),
    alioRow(4, "한빛센터", "임원 연봉", "checked", { result: result("한빛센터", "임원연봉") }),
  ];
  const s = buildSummary(inputs, {}, ["임원연봉"]);
  check(s.institutions.map((i) => `${i.rank ?? "-"}.${i.institution}`).join() === "1.남북협회,2.한빛센터", "점검 기준이 있는 항목의 결과만 순위에 들어감", s.institutions.map((i) => i.institution).join());
  check(s.institutions[0].highCount === 2, "점검 기준이 없는 항목은 지적 수에 영향 없음");
  check(!s.institutions.some((i) => i.institution === "예술센터"), "보고서가 없는 기관은 순위에 나오지 않음 (결과 표에는 보임)");
  check(uncheckedCount(inputs) === 1, "점검 기준이 없어 순위에 넣지 않은 건 수를 셈");

  const both = buildSummary([
    alioRow(1, "남북협회", "임원 연봉", "checked", { result: result("남북협회", "임원연봉", [finding()]) }),
    alioRow(2, "남북협회", "직원 평균보수", "not-found"),
  ], {}, ["임원연봉", "직원평균보수"]);
  check(both.institutions[0].note === "알리오에서 보고서를 찾지 못함: 직원평균보수" && !both.institutions[0].note.includes("업로드"), "빠진 항목은 '업로드되지 않음' 대신 '알리오에서 보고서를 찾지 못함'으로 알림", both.institutions[0].note);

  const only = buildSummary([alioRow(1, "남북협회", "임직원 수", "extracted-only", { result: result("남북협회", null) })], {}, []);
  check(only.institutions.length === 0, "점검 기준이 없는 항목만 가져오면 순위 표는 비어 있음 (값 표는 결과 표에서 봄)");

  const running = buildSummary([alioRow(1, "남북협회", "임원 연봉", "checked", { result: result("남북협회", "임원연봉") }), { id: 2, fileName: "x", phase: "running", alio: { institutionName: "x", itemName: "y", period: null, outcome: "request-failed" } }], {}, ["임원연봉"]);
  check(running === null, "점검이 덜 끝났으면 요약을 만들지 않음");

  const plain = buildSummary([{ id: 1, fileName: "a.pdf", phase: "done", result: result("한빛", "임원연봉") }]);
  check(plain.institutions[0].note === "업로드되지 않음: 직원평균보수", "파일 올리기만 쓴 경우는 예전 문구('업로드되지 않음') 그대로", plain.institutions[0].note);
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
