// 알리오 바로가기·PDF 받기 주소와 수정 예시(보완 요청 예시)를 확인한다.
//
// 실행:  node scripts/check_links.mjs
import { alioItemUrl, alioPdfUrl } from "../lib/alio/links.ts";
import { CHECKLIST, fixHintFor } from "../lib/checklist.ts";
import { buildResultRows } from "../lib/result-view.ts";
import { buildSummary } from "../lib/summary-view.ts";
import { buildDetail } from "../lib/detail-view.ts";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

console.log("== 1. 알리오 주소");
check(alioItemUrl("2050") === "https://www.alio.go.kr/item/itemOrganList.do?reportFormRootNo=2050", "항목 화면 주소", alioItemUrl("2050"));
check(alioPdfUrl("2026053106") === "https://www.alio.go.kr/download/pdf.json?disclosureNo=2026053106", "PDF 받기 주소", alioPdfUrl("2026053106"));
check(alioItemUrl("2050&x=1") === null && alioItemUrl("") === null && alioItemUrl("javascript:1") === null, "항목 번호에 숫자 외 글자가 있으면 주소를 만들지 않음");
check(alioPdfUrl("1/../../x") === null && alioPdfUrl("12") === null && alioPdfUrl("") === null, "공시번호에 숫자 외 글자가 있으면 주소를 만들지 않음");
check(alioItemUrl("2050")?.startsWith("https://www.alio.go.kr/") && alioPdfUrl("2026053106")?.startsWith("https://www.alio.go.kr/"), "주소는 항상 www.alio.go.kr");

console.log("\n== 2. 결과 표에 링크");
{
  const res = { fileName: "x", status: "ok", institution: "공항", itemType: "임원연봉", extracted: [], findings: [], elapsedMs: 1, model: "m" };
  const rows = buildResultRows([
    { id: 1, fileName: "공항 · 임원 연봉", phase: "done", result: res, alio: { institutionName: "공항", itemName: "임원 연봉", period: null, outcome: "checked", formNo: "2050", disclosureNo: "2026053106" } },
    { id: 2, fileName: "공항 · 임직원 수", phase: "error", reason: "시간 초과", alio: { institutionName: "공항", itemName: "임직원 수", period: null, outcome: "fetch-failed", formNo: "2020" } },
    { id: 3, fileName: "b.pdf", phase: "done", result: res },
  ]);
  check(rows[0].alioLinks?.itemUrl?.endsWith("reportFormRootNo=2050") && rows[0].alioLinks?.pdfUrl?.endsWith("disclosureNo=2026053106"), "알리오 건: 항목 화면과 PDF 링크");
  check(rows[1].alioLinks?.itemUrl && rows[1].alioLinks.pdfUrl === null, "보고서를 못 찾은·못 가져온 건: PDF 링크 없이 항목 화면 링크만");
  check(rows[2].alioLinks === null, "직접 올린 파일: 링크 없음");
}

console.log("\n== 3. 수정 예시");
{
  const missing = CHECKLIST.filter((r) => !fixHintFor(r.id));
  check(missing.length === 0, `모든 점검 기준(${CHECKLIST.length}개)에 수정 예시가 있음`, missing.map((r) => r.id).join(","));
  check(CHECKLIST.every((r) => fixHintFor(r.id)?.action && fixHintFor(r.id)?.example), "수정 방법과 예시가 모두 비어 있지 않음");
  check(fixHintFor("R99-9") === undefined, "없는 기준 번호는 예시 없음");
  const res = { fileName: "x", status: "ok", institution: "공항", itemType: "임원연봉", extracted: [], model: "m", elapsedMs: 1,
    findings: [{ ruleId: "R10-6", message: "오류 가능성: 성별 평균보수가 없는 것으로 보입니다.", confidence: "높음", evidence: { quote: "임원 보수 현황", location: "1쪽" } }] };
  const s = buildSummary([{ id: 1, fileName: "a.pdf", phase: "done", result: res }]);
  const d = buildDetail(s.institutions[0], () => "a.pdf");
  check(d.groups[0].items[0].fix?.example.includes("남성") && d.groups[0].items[0].fix?.action.includes("성별"), "상세의 지적에 그 기준의 수정 예시가 붙음", d.groups[0].items[0].fix?.action);
  check(!/오류입니다|고쳤습니다|자동으로 고/.test(CHECKLIST.map((r) => fixHintFor(r.id)?.action).join(" ")), "예시 문구가 단정하거나 앱이 고치는 것처럼 쓰지 않음");
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
