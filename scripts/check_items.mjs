// 항목별 점검 기준(lib/checklist.ts)과 알리오 항목 연결(lib/alio/items.ts)을 확인한다.
//
// 실행:  node scripts/check_items.mjs
// AI·인터넷 없이 시험한다.
import { CHECKLIST, ITEM_CYCLE, UPLOAD_ITEM_TYPES, fixHintFor, rulesFor } from "../lib/checklist.ts";
import { FETCHABLE_ITEMS } from "../lib/alio/items.ts";
import { ITEM_TYPES } from "../lib/check-file.ts";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const types = Object.keys(ITEM_CYCLE);
const withChecklist = FETCHABLE_ITEMS.filter((i) => i.checklist);

console.log("== 1. 항목 종류");
check(types.length === 9, "점검 기준이 있는 항목 종류는 9개", types.join(", "));
check(ITEM_TYPES.join() === "임원연봉,직원평균보수" && UPLOAD_ITEM_TYPES.join() === "임원연봉,직원평균보수", "직접 올린 파일의 분류·'업로드되지 않음' 대상은 시연 범위 2종 그대로");
check(withChecklist.length === 9 && new Set(withChecklist.map((i) => i.checklist)).size === 9, "알리오 항목 9개에 점검 기준이 연결됨", withChecklist.map((i) => `${i.no}:${i.checklist}`).join(" "));
check(types.every((t) => CHECKLIST.some((r) => r.scope === t)), "모든 항목 종류에 기준이 1개 이상 있음");

console.log("\n== 2. 기준마다 근거");
check(CHECKLIST.every((r) => r.id && r.question && r.criterion && r.source), "모든 기준에 번호·질문·원문 문구·근거 위치가 있음");
check(CHECKLIST.filter((r) => r.scope !== "공통").every((r) => /^별표 1 \d+번 /.test(r.source)), "항목 기준의 근거는 모두 '별표 1 ○번 …' 형태");
check(CHECKLIST.filter((r) => r.scope === "공통").every((r) => /^제\d+조/.test(r.source)), "공통 기준의 근거는 모두 조항 번호");
check(new Set(CHECKLIST.map((r) => r.id)).size === CHECKLIST.length, "기준 번호가 겹치지 않음");
check(CHECKLIST.every((r) => fixHintFor(r.id)), `모든 기준(${CHECKLIST.length}개)에 보완 요청 예시가 있음`, CHECKLIST.filter((r) => !fixHintFor(r.id)).map((r) => r.id).join(","));

console.log("\n== 3. 갱신주기에 맞는 공통 기준만 적용");
{
  const ids = (t) => rulesFor(t).filter((r) => r.scope === "공통").map((r) => r.id).join();
  check(ids("임원연봉") === "C-1,C-2" && ids("직원평균보수") === "C-1,C-2" && ids("복리후생비") === "C-1,C-2", "연 1회(4월말) 항목: 5년 자료 + 4월말 갱신", ids("복리후생비"));
  check(ids("임직원수") === "C-3" && ids("신규채용") === "C-3", "분기 항목: 분기 갱신만 (5년 자료·4월말 기준은 묻지 않음)", ids("임직원수"));
  check(ids("장애인고용") === "C-1,C-4", "연 1회(7월말) 항목: 5년 자료 + 7월말 갱신", ids("장애인고용"));
  check(!rulesFor("임직원수").some((r) => r.id === "C-2"), "분기 항목에 '매년 4월말' 기준이 섞이지 않음");
}

console.log("\n== 4. 고시 원문과 같은 문구 (별표 1, 2025.12.30 개정)");
{
  const want = [
    ["R3-2", "일반정규직(정원, 현원)"],
    ["R3-7", "직급별 인원수(남성, 여성)"],
    ["R12-1", "업무추진비 집행내역"],
    ["R13-1", "각종 급여성ㆍ비급여성 복리후생비 지급현황 및 지급기준"],
    ["R26-11", "여성 보수 비율"],
    ["R28-1", "장애인 의무 고용률 현황"],
    ["R35-3", "지출 - 사업비, 인건비, 경상운영비, 차입금상환, 기타"],
  ];
  for (const [id, text] of want) check(CHECKLIST.find((r) => r.id === id)?.criterion === text, `${id} 원문 문구`, text);
  check(rulesFor("복리후생비").filter((r) => r.scope === "복리후생비").length === 4 && rulesFor("일가정양립").filter((r) => r.scope === "일가정양립").length === 11, "복리후생비 4개·일·가정 양립 11개 기준");
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
