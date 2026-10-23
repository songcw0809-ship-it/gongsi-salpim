// 그래프에 쓰는 숫자 뽑기(lib/chart-data.ts)를 확인한다.
//
// 실행:  node scripts/check_charts.mjs
import { buildExtractedSections } from "../lib/extracted-view.ts";
import { buildYearChart, parseNumber, buildFindingBars, countStatuses } from "../lib/chart-data.ts";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};
const f = (label, value) => ({ label, value, location: "1쪽" });
const YEARS = "2021년 결산 2022년 결산 2026년 예산";

console.log("== 1. 숫자 읽기");
check(parseNumber("145,092") === 145092 && parseNumber("0") === 0 && parseNumber("-12") === -12, "쉼표 있는 숫자");
check(parseNumber("-") === null && parseNumber("") === null, "'-'·빈 칸은 값 없음(null)");
check(parseNumber("연봉제") === undefined && parseNumber("해당사항 없음") === undefined, "글자는 숫자 줄이 아님");

console.log("\n== 2. 연도별 그래프");
{
  const sec = buildExtractedSections([
    f("상임기관장 단위", "천원"),
    f("상임기관장 열 순서", YEARS),
    f("상임기관장 기본급", "100 110 120"),
    f("상임기관장 고정수당", "0 0 0"),
    f("상임기관장 성과상여금", "50 40 0"),
    f("상임기관장 (경영평가 성과급)", "50 40 0"),
    f("상임기관장 합계", "150 150 120"),
    f("상임기관장 비고", "연봉제 연봉제 연봉제"),
  ])[0];
  const c = buildYearChart(sec);
  check(c?.mode === "stacked" && c.years.length === 3 && c.unit === "천원", "합계 줄이 있으면 쌓은 막대, 단위는 표 설명에서", `${c?.mode} ${c?.unit}`);
  check(c?.budget.join() === "false,false,true", "예산 열을 구분");
  check(c?.series.map((s) => s.label).join() === "기본급,성과상여금", "모두 0인 줄과 '(…)' 딸린 줄, 글자 줄은 그래프에 안 넣음", c?.series.map((s) => s.label).join());
  check(c?.totals?.join() === "150,150,120" && c.mismatch === false, "합계 줄의 값을 그대로 쓰고 항목 합과 같으면 불일치 표시 없음");
  const bad = buildYearChart(buildExtractedSections([f("상임감사 구분", YEARS), f("상임감사 기본급", "100 100 100"), f("상임감사 합계", "300 300 300")])[0]);
  check(bad?.mismatch === true, "항목 합이 합계와 다르면 불일치로 알림", String(bad?.mismatch));
  const grouped = buildYearChart(buildExtractedSections([f("임원 구분", YEARS), f("임원 (남성)", "10 20 30"), f("임원 (여성)", "5 - 6")])[0]);
  check(grouped?.mode === "grouped" && grouped.series.length === 2 && grouped.series[1].values[1] === null, "합계 줄이 없으면 나란히 보임, '-'는 값 없음", grouped?.mode);
  check(buildYearChart(buildExtractedSections([f("기관명", "가"), f("공시 시기", "2026")])[0]) === null, "연도 열이 없는 표는 그래프 없음");
  check(buildYearChart(buildExtractedSections([f("임원 구분", YEARS), f("임원 비고", "가 나 다")])[0]) === null, "숫자 줄이 없으면 그래프 없음");
}

console.log("\n== 3. 기관별 의심 항목 막대");
{
  const bars = buildFindingBars([
    { institution: "A", rank: 1, countsByConfidence: { 높음: 3, 중간: 1, 낮음: 0 } },
    { institution: "B", rank: 2, countsByConfidence: { 높음: 1, 중간: 0, 낮음: 0 } },
    { institution: "C", rank: null, countsByConfidence: { 높음: 9, 중간: 0, 낮음: 0 } },
  ]);
  check(bars.length === 2 && bars[0].total === 4 && bars[0].percent === 100 && bars[1].percent === 25, "순위가 있는 기관만, 가장 긴 막대를 100%로", bars.map((b) => `${b.institution}:${b.percent}`).join(" "));
  check(buildFindingBars([]).length === 0, "기관이 없으면 막대 없음");
}

console.log("\n== 4. 점검 현황 묶음");
{
  const p = countStatuses(["ready", "unclassified", "unchecked", "not-found", "duplicate", "failed", "running"]);
  check(p.map((x) => `${x.key}:${x.count}`).join() === "done:2,waiting-criteria:1,none:2,problem:1,progress:1", "상태를 다섯 묶음으로 세고 0건인 묶음은 뺌", p.map((x) => `${x.key}:${x.count}`).join());
  check(countStatuses([]).length === 0, "결과가 없으면 비어 있음");
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
