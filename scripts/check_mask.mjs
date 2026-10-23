// 개인정보 가림(lib/mask.ts)과 결과 표·상세에서의 적용을 확인한다.
//
// 실행:  node scripts/check_mask.mjs
// AI·화면 없이 시험한다.

import { MASK, maskAll, maskPii, maskText } from "../lib/mask.ts";
import { buildResultRows } from "../lib/result-view.ts";
import { buildSummary } from "../lib/summary-view.ts";
import { buildDetail } from "../lib/detail-view.ts";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

console.log("== 1. 가려야 하는 값");
{
  const cases = [
    ["문의 02-123-4567 로", MASK.phone, "서울 지역번호"],
    ["031-1234-5678", MASK.phone, "경기 지역번호"],
    ["010-1234-5678", MASK.phone, "휴대폰(하이픈)"],
    ["010.1234.5678", MASK.phone, "휴대폰(점)"],
    ["010 1234 5678", MASK.phone, "휴대폰(공백)"],
    ["01012345678", MASK.phone, "휴대폰(구분 기호 없음)"],
    ["070-123-4567", MASK.phone, "인터넷전화"],
    ["담당 hong.gildong@example.go.kr 입니다", MASK.email, "이메일"],
    ["a_b+c@sub.domain.co.kr", MASK.email, "이메일(부호·하위 도메인)"],
    ["900101-1234567", MASK.rrn, "주민등록번호"],
    ["010101-3234567", MASK.rrn, "주민등록번호(2000년대생)"],
  ];
  for (const [input, label, name] of cases) {
    const r = maskPii(input);
    check(r.text.includes(label) && r.count === 1 && !/\d{3}-?\d{4}/.test(r.text.replace(/\[.*?\]/g, "")), `${name}: ${input} → 가림`, r.text);
  }
  const multi = maskPii("연락처 02-123-4567, 010-9999-8888, a@b.kr, 800101-2345678");
  check(multi.count === 4 && !/\d{2,}-\d/.test(multi.text), "한 글자에 여러 개 있으면 모두 가리고 수를 셈", `${multi.count}개 · ${multi.text}`);
}

console.log("\n== 2. 가리면 안 되는 값 (공시 표의 숫자들)");
{
  const keep = [
    "98,129", "1,234,567,890", "158,431천원", "2021년 결산 98,129 2022년 결산 98,129",
    "2021-2025", "2026-10-23", "2026.10.23", "2026년 1/4분기", "100%", "12.5%",
    "사업자등록번호 123-45-67890", "계좌 110-123-456789", "고유번호 1234567890123",
    "3,500 3,500 3,500 3,500", "R10-1", "별표 1 10번 임원연봉", "42,144 44,097 -",
    "제6조 제2항", "01-12-2024", "1588-1234",
  ];
  for (const s of keep) {
    const r = maskPii(s);
    check(r.text === s && r.count === 0, `그대로 둠: ${s}`);
  }
}

console.log("\n== 3. 성질");
{
  const once = maskText("010-1234-5678 a@b.kr");
  check(maskText(once) === once, "이미 가린 글자를 다시 가려도 그대로 (여러 번 거쳐도 안전)");
  check(maskPii("").count === 0 && maskText("") === "", "빈 글자는 그대로");
  const all = maskAll(["010-1234-5678", undefined, "a@b.kr", "없음"]);
  check(all.count === 2 && all.texts[1] === undefined && all.texts[3] === "없음", "여러 글자를 한꺼번에 가리고 총 수를 셈, undefined 는 그대로");
  check(maskText("메일a@b.kr/전화010-1234-5678") === `메일${MASK.email}/전화${MASK.phone}`, "글자에 붙어 있어도 번호 부분만 가림");
}

const f = (message, quote, location = "3쪽") => ({ ruleId: "R10-1", message, confidence: "높음", evidence: { quote, location } });
const result = (extracted, findings = []) => ({ fileName: "x", status: "ok", institution: "한빛에너지공사", itemType: "임원연봉", extracted, findings, elapsedMs: 1, model: "gpt-6.1-sol" });

console.log("\n== 4. 결과 표에 적용");
{
  const rows = buildResultRows([
    { id: 1, fileName: "한빛(담당 hong@x.kr).pdf", phase: "done", result: result([
      { label: "담당자 연락처", value: "02-123-4567", location: "1쪽" },
      { label: "담당자 메일", value: "hong@example.go.kr", location: "1쪽" },
      { label: "기본급", value: "98,129", location: "3쪽" },
    ]) },
    { id: 2, fileName: "b.pdf", phase: "done", result: result([{ label: "기본급", value: "1", location: "1쪽" }]) },
  ]);
  const a = rows[0];
  check(a.extracted[0].value === MASK.phone && a.extracted[1].value === MASK.email && a.extracted[2].value === "98,129", "추출한 값 중 개인정보 형태만 가리고 금액은 그대로", a.extracted.map((x) => x.value).join(" / "));
  check(a.maskedCount === 3 && rows[1].maskedCount === 0, "가린 값의 수를 줄마다 셈 (파일 이름 안의 이메일 포함)", `${a.maskedCount}개`);
  check(a.fileName.includes(MASK.email) && !a.fileName.includes("hong@x.kr"), "파일 이름에 섞인 이메일도 가림", a.fileName);
}

console.log("\n== 5. 상세 패널에 적용");
{
  const inputs = [{ id: 1, fileName: "한빛.pdf", phase: "done", result: result([], [
    f("오류 가능성: 담당자 010-1234-5678 옆에 기본급이 없는 것으로 보입니다.", "담당 hong@example.go.kr 임원 보수 현황", "3쪽"),
    f("오류 가능성: 수당이 없는 것으로 보입니다.", "항목별 수당"),
  ]) }];
  const s = buildSummary(inputs);
  const d = buildDetail(s.institutions[0], (k) => (k === "1" ? "한빛_임원연봉(문의 02-123-4567).pdf" : k));
  const items = d.groups[0].items;
  check(items[0].message.includes(MASK.phone) && !items[0].message.includes("010-1234-5678"), "지적 설명 속 전화번호를 가림", items[0].message);
  check(items[0].quote.includes(MASK.email) && !items[0].quote.includes("hong@example"), "인용문 속 이메일을 가림", items[0].quote);
  check(items[1].message === "오류 가능성: 수당이 없는 것으로 보입니다." && items[1].quote === "항목별 수당", "개인정보가 없는 지적은 그대로");
  check(d.maskedCount === 3, "가린 값의 총 수를 셈 (설명 1 + 인용문 1 + 파일 이름 1)", `${d.maskedCount}개`);
  check(d.groups[0].fileName.includes(MASK.phone), "파일 이름에 섞인 전화번호도 가림", d.groups[0].fileName);
  check(items[0].criterion === "임원별 기본급(기본연봉)", "체크리스트의 기준 문구는 가리지 않음 (우리가 만든 고정 문구)");
}

console.log("\n== 6. 원본은 그대로 (검증은 원본으로 한다)");
{
  const original = result([{ label: "연락처", value: "02-123-4567", location: "1쪽" }]);
  buildResultRows([{ id: 1, fileName: "a.pdf", phase: "done", result: original }]);
  check(original.extracted[0].value === "02-123-4567", "가려서 보여 줄 뿐 받은 결과 자체는 바꾸지 않음");
}

console.log("\n== 7. 알리오 공개 보고서는 가리지 않고, 올린 파일만 가린다");
{
  const alioInput = { id: 1, fileName: "공항(문의 02-123-4567).pdf", phase: "done", result: result([{ label: "담당자 연락처", value: "02-123-4567", location: "1쪽" }]), alio: { institutionName: "공항", itemName: "임직원 수", period: null, outcome: "checked" } };
  const upload = { id: 2, fileName: "b.pdf", phase: "done", result: result([{ label: "담당자 연락처", value: "02-123-4567", location: "1쪽" }]) };
  const rows = buildResultRows([alioInput, upload]);
  check(rows[0].extracted[0].value === "02-123-4567" && rows[0].fileName.includes("02-123-4567") && rows[0].maskedCount === 0, "알리오 보고서의 값·파일 이름은 원문 그대로, 가린 수 0");
  check(rows[1].extracted[0].value === MASK.phone && rows[1].maskedCount === 1, "직접 올린 파일은 지금처럼 가림");
  const s2 = buildSummary([{ ...alioInput, result: result([], [f("오류 가능성: 담당 010-1234-5678 확인 필요.", "담당 hong@example.go.kr 현황")]) }]);
  const d2 = buildDetail(s2.institutions[0], (k) => (k === "1" ? "공항(문의 02-123-4567).pdf" : k), (k) => k === "1");
  const it = d2.groups[0].items[0];
  check(it.message.includes("010-1234-5678") && it.quote.includes("hong@example.go.kr") && d2.groups[0].fileName.includes("02-123-4567") && d2.maskedCount === 0, "알리오 보고서의 상세(설명·인용문·파일 이름)도 가리지 않음");
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
