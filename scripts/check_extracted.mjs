// 추출한 값을 표로 바꾸는 규칙(lib/extracted-view.ts)을 확인한다.
//
// 실행:  node scripts/check_extracted.mjs
import { buildExtractedSections } from "../lib/extracted-view.ts";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};
const f = (label, value) => ({ label, value, location: "1쪽" });
const YEARS = "2021년 결산 2022년 결산 2023년 결산";

const s = buildExtractedSections([
  f("보고서명", "10. 임원 연봉"),
  f("기관명", "인천국제공항공사"),
  f("상임기관장 단위", "천원"),
  f("상임기관장 구분", YEARS),
  f("상임기관장 기본급", "145,092 146,398 148,448"),
  f("상임기관장 비고", "연봉제 연봉제 연봉제"),
  f("상임기관장 세부수당 별도첨부", "해당사항 없음 해당사항 없음 해당사항 없음"),
  f("상임감사 구분", YEARS),
  f("상임감사 기본급", "추출 불가"),
  f("상임감사 합계", "1 2"),
]);
check(s.map((x) => x.title).join() === "기본 정보,상임기관장,상임감사", "첫 단어가 같은 항목끼리 묶음", s.map((x) => x.title).join());
check(s[0].rows.length === 2 && s[0].rows[0].label === "보고서명" && s[0].columns.length === 0, "묶이지 않는 항목은 '기본 정보'에 이름 그대로");
const boss = s[1];
check(boss.caption === "단위: 천원" && boss.columns.join() === "2021년 결산,2022년 결산,2023년 결산", "단위는 표 설명, 구분의 연도는 열 제목");
check(!boss.rows.some((r) => r.label === "구분" || r.label === "단위"), "구분·단위 줄은 표 본문에 넣지 않음");
check(boss.rows[0].label === "기본급" && boss.rows[0].cells.join() === "145,092,146,398,148,448", "값을 열마다 한 칸으로 나눔", boss.rows[0].cells.join(" | "));
check(boss.rows[2].cells.join() === "해당사항 없음,해당사항 없음,해당사항 없음", "여러 단어로 된 값도 열 수로 똑같이 나눌 수 있으면 나눔");
check(s[2].rows[0].merged && s[2].rows[0].cells[0] === "추출 불가", "열 수와 안 맞는 값은 나누지 않고 한 칸에 그대로");
check(s[2].rows[1].merged && s[2].rows[1].cells[0] === "1 2", "값의 수가 열 수와 맞지 않으면 짐작해서 나누지 않음");

const alt = buildExtractedSections([
  f("상임감사 구분(아래 각 항목의 값 순서)", "2021년 결산 2022년 결산 2026년 예산"),
  f("상임감사 기본급", "1 2 3"),
  f("상임이사 구분", "2021년 결산 2022년 결산 2026년 예산"),
]);
check(alt[0].columns.join() === "2021년 결산,2022년 결산,2026년 예산" && alt[0].rows.length === 1 && alt[0].rows[0].cells.length === 3, "'구분(설명)'처럼 뒤에 글자가 붙은 구분 줄도 열 제목으로 씀");

const kinds = buildExtractedSections([
  f("상임감사 구분", YEARS),
  f("상임감사 기본급", "1 2 3"),
  f("상임감사 (경영평가 성과급)", "4 5 6"),
  f("상임감사 합계", "5 7 9"),
  f("상임감사 경영평가 성과급 주석", "* 경영평가 성과급의 경우 당해연도 예산은 미확정으로 0으로 기재"),
  f("상임감사 비고", "연봉제 연봉제 연봉제"),
])[0].rows.map((r) => r.kind).join();
check(kinds === "normal,sub,total,note,normal", "줄 종류: 합계·(괄호) 딸림 줄·긴 주석을 구분하고 비고 같은 짧은 줄은 보통 줄", kinds);

const flat =buildExtractedSections([f("기관명", "가"), f("공시 시기", "2026년 1/4분기"), f("총 인원", "10")]);
check(flat.length === 1 && flat[0].title === "기본 정보" && flat[0].rows.length === 3 && flat[0].rows[1].label === "공시 시기", "묶음이 없으면 한 표, 한 번만 나온 첫 단어는 묶지 않음");
check(buildExtractedSections([]).length === 0, "비어 있으면 표 없음");
const one = buildExtractedSections([f("임원 구분", "2021년"), f("임원 기본급", "1 2")]);
check(one[0].columns.length === 0 && one[0].rows.length === 2, "연도가 1개뿐인 구분은 열 제목으로 쓰지 않고 값을 잃지 않음");
const kept = s.reduce((n, x) => n + x.rows.length, 0);
check(kept === 7, "구분(2)·단위(1)를 뺀 모든 항목이 표에 남음", `${kept}개`);

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
