// 검증 장치(lib/guard.ts)가 PRD 규칙대로 지적을 거르는지 확인한다.
//
// 실행:  node scripts/check_guard.mjs
// AI 호출 없이, 샘플 PDF에서 뽑은 실제 글자에 "AI가 낸 지적"을 흉내 내어 시험한다.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rulesFor } from "../lib/checklist.ts";
import { verifyFindings } from "../lib/guard.ts";
import { extractPdf } from "../lib/extract/pdf.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = join(ROOT, "samples");
const key = JSON.parse(readFileSync(join(SAMPLES, "answer-key.json"), "utf-8"));

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const load = async (file) => {
  const r = await extractPdf(readFileSync(join(SAMPLES, file)));
  if (r.status !== "ok") throw new Error(`${file}: ${r.status}`);
  return r.units;
};
const rawOf = (ruleId, quote, extra = {}) => ({
  ruleId,
  message: "해당 항목이 없는 것으로 보입니다.",
  confidence: "높음",
  evidence: { quote, location: "1쪽" },
  ...extra,
});

const execFile = "가온에너지공단_임원연봉.pdf";
const units = await load(execFile);
const rules = rulesFor("임원연봉");

console.log("== 1. 근거가 있는 지적은 통과");
{
  const r = verifyFindings([rawOf("R10-1", "임원 보수 현황")], units, rules);
  const f = r.findings[0];
  check(r.findings.length === 1 && r.dropped.length === 0, "항목이 빠졌다는 지적 + 표 제목 인용 → 통과");
  check(f?.evidence.location === "1쪽", "원문 위치가 실제 위치(1쪽)로 채워짐", f?.evidence.location);
  check(f?.confidence === "높음", "인용문이 모두 있으면 '높음' 유지");
}

console.log("\n== 2. 근거 없는 지적은 버림");
{
  const cases = [
    ["지어낸 인용문", rawOf("R10-1", "이 문장은 파일에 없습니다 절대로")],
    ["인용문 없음", rawOf("R10-1", "")],
    ["인용문이 너무 짧음", rawOf("R10-1", "기")],
    ["없는 기준 번호", rawOf("R99-9", "임원 보수 현황")],
    ["다른 항목의 기준 번호 (임원연봉 파일에 R11-2)", rawOf("R11-2", "임원 보수 현황")],
  ];
  for (const [label, raw] of cases) {
    const r = verifyFindings([raw], units, rules);
    check(r.findings.length === 0 && r.dropped.length === 1, `${label} → 버림`, r.dropped[0]?.reason);
  }
}

console.log("\n== 3. 위치는 AI 말을 믿지 않음");
{
  const r = verifyFindings([rawOf("R10-1", "임원 보수 현황", { evidence: { quote: "임원 보수 현황", location: "9쪽" } })], units, rules);
  check(r.findings[0]?.evidence.location === "1쪽", "AI가 '9쪽'이라 적어도 실제 위치 '1쪽'으로 바꿈");
}

console.log("\n== 4. 말줄임표 인용과 신뢰도");
{
  const all = verifyFindings([rawOf("R10-1", "임원 보수 현황 … (단위: 천원)")], units, rules);
  check(all.findings[0]?.confidence === "높음", "조각이 모두 있으면 '높음' 유지");
  const part = verifyFindings([rawOf("R10-1", "임원 보수 현황 … 파일에 없는 조각입니다")], units, rules);
  check(part.findings[0]?.confidence === "중간", "조각 일부만 있으면 '높음' → '중간'으로 낮춤", part.findings[0]?.confidence);
  const part2 = verifyFindings([rawOf("R10-1", "임원 보수 현황 … 파일에 없는 조각입니다", { confidence: "중간" })], units, rules);
  check(part2.findings[0]?.confidence === "낮음", "'중간' + 일부만 있으면 '낮음'");
  const none = verifyFindings([rawOf("R10-1", "없는 조각입니다 … 이것도 없습니다")], units, rules);
  check(none.findings.length === 0, "조각이 하나도 없으면 버림");
}

console.log("\n== 5. 신뢰도 정리");
{
  const conf = (c) => verifyFindings([rawOf("R10-1", "임원 보수 현황", { confidence: c })], units, rules).findings[0]?.confidence;
  check(conf("high") === "높음" && conf("중간") === "중간" && conf("낮음") === "낮음", "high/중간/낮음을 세 단계로 맞춤");
  check(conf(undefined) === "낮음" && conf("모르겠음") === "낮음", "신뢰도가 없거나 알 수 없으면 가장 낮게 봄");
}

console.log("\n== 6. 단정 표현 → 오류 가능성");
{
  const r = verifyFindings([rawOf("R10-1", "임원 보수 현황", { message: "기본급이 없어 명백히 오류입니다." })], units, rules);
  const m = r.findings[0]?.message ?? "";
  check(m.startsWith("오류 가능성"), "'오류 가능성'으로 시작", m);
  check(!m.includes("오류입니다") && !m.includes("명백"), "'오류입니다'·'명백히' 같은 단정이 없어짐");
  const empty = verifyFindings([rawOf("R10-1", "임원 보수 현황", { message: "" })], units, rules).findings[0];
  check(empty?.message.startsWith("오류 가능성"), "설명이 비어 있어도 '오류 가능성'으로 채움", empty?.message);
}

console.log("\n== 7. 같은 기준의 지적이 여럿이면 하나만");
{
  const r = verifyFindings(
    [rawOf("R10-1", "임원 보수 현황", { confidence: "낮음" }), rawOf("R10-1", "임원 보수 현황", { confidence: "높음" })],
    units, rules,
  );
  check(r.findings.length === 1 && r.findings[0].confidence === "높음" && r.dropped.length === 1, "신뢰도가 높은 하나만 남기고 나머지는 합침");
}

console.log("\n== 8. 샘플 12개 전체: 정답 지적은 모두 통과, 지어낸 지적은 모두 버림");
// '완벽한 AI'가 정답지의 오류를 그대로 지적했다고 가정한다. 인용문은 파일에 실제로 있는 문구를 쓴다.
const QUOTE = {
  "R10-1": "임원 보수 현황", "R10-3": "임원 보수 현황", "R10-4": "임원 보수 현황", "R10-5": "임원 보수 현황", "R10-6": "임원 보수 현황",
  "R10-7": "기준 시점: 2026년 6월 30일 기준",
  "R11-2": "직원 1인당 평균 보수", "R11-3": "직원 평균근속연수", "R11-4": "직원 1인당 평균 보수",
  "C-1": "공시 기간: 2024년 ~ 2025년 (2개년)", "C-2": "공시일: 2026-06-15",
};
let passed = 0, expectedTotal = 0, fakeDropped = 0, fakeTotal = 0, leaked = 0;
for (const f of key.files) {
  const u = await load(f.file);
  const rl = rulesFor(f.itemType);
  const truth = f.errors.map((e) => rawOf(e.ruleId, QUOTE[e.ruleId]));
  // 위반하지 않은 기준에 대해 지어낸 인용문으로 만든 가짜 지적
  const wrong = new Set(f.errors.map((e) => e.ruleId));
  const fakes = rl.filter((x) => !wrong.has(x.id)).map((x) => rawOf(x.id, `지어낸 근거 문장 ${x.id} 파일에는 없음`));
  const r = verifyFindings([...truth, ...fakes], u, rl);
  const got = r.findings.map((x) => x.ruleId).sort().join();
  const want = [...wrong].sort().join();
  expectedTotal += truth.length;
  passed += r.findings.filter((x) => wrong.has(x.ruleId)).length;
  fakeTotal += fakes.length;
  fakeDropped += r.dropped.filter((d) => d.reason.includes("글자에 없음")).length;
  leaked += r.findings.filter((x) => !wrong.has(x.ruleId)).length;
  check(got === want, f.file, `통과 [${got || "-"}]`);
}
check(passed === expectedTotal && expectedTotal === key.totalErrors, `정답 지적 ${passed}/${expectedTotal}개 통과 (심은 오류 ${key.totalErrors}개)`);
check(fakeDropped === fakeTotal && leaked === 0, `지어낸 지적 ${fakeDropped}/${fakeTotal}개 버림, 새어 나간 것 ${leaked}개`);

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
