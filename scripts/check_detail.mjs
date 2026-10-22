// 의심 항목 상세(lib/detail-view.ts)가 PRD 5번 M2·DESIGN §1.2 ④ 대로 데이터를 만드는지 확인한다.
//
// 실행:  node scripts/check_detail.mjs
// AI 호출·화면 없이 시험한다.

import { buildSummary } from "../lib/summary-view.ts";
import { buildDetail } from "../lib/detail-view.ts";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const finding = (ruleId = "R10-1", confidence = "높음", extra = {}) => ({
  ruleId, message: "오류 가능성: 기본급 항목이 없는 것으로 보입니다.", confidence,
  evidence: { quote: "임원 보수 현황", location: "3쪽" }, ...extra,
});
const result = (institution, itemType, findings = [], extra = {}) => ({
  fileName: "x", status: "ok", institution, itemType, extracted: [], findings, elapsedMs: 1, model: "gpt-6.1-sol", ...extra,
});
const done = (id, r) => ({ id, fileName: `f${id}.pdf`, phase: "done", result: r });
const nameOf = (key) => ({ 1: "가온_임원연봉.pdf", 2: "가온_직원평균보수.pdf", 3: "누리_임원연봉.pdf" })[key] ?? key;
const detailOf = (inputs, name, choices = {}) => {
  const s = buildSummary(inputs, choices);
  return buildDetail(s.institutions.find((i) => i.institution === name), nameOf);
};

console.log("== 1. 지적마다 근거 기준·원문 위치·신뢰도가 함께 나옴");
{
  const d = detailOf([
    done(1, result("가온에너지공단", "임원연봉", [finding("R10-1", "높음"), finding("R10-2", "중간", { evidence: { quote: "항목별 수당", location: "4쪽" } })])),
  ], "가온에너지공단");
  const item = d.groups[0].items[0];
  check(d.rank === 1 && d.emptyMessage === null, "순위와 함께, 지적이 있으면 빈 문구 없음");
  check(item.ruleId === "R10-1" && item.criterion === "임원별 기본급(기본연봉)" && item.source === "별표 1 10번 임원연봉", "근거 기준 번호·기준 문구·고시 위치가 체크리스트에서 붙음", `${item.ruleId} · ${item.source}`);
  check(item.location === "3쪽" && item.quote === "임원 보수 현황", "원문 위치와 인용문이 함께 나옴");
  check(item.confidence === "높음" && d.groups[0].items[1].confidence === "중간", "신뢰도가 지적마다 붙고 높은 것부터 나옴");
  check(item.message.startsWith("오류 가능성"), "'오류 가능성'으로 시작하는 문구 그대로");
  check(d.groups.every((g) => g.items.every((i) => i.criterion && i.source && i.location && i.quote && i.confidence)), "모든 지적에 기준·위치·인용문·신뢰도가 있음");
}

console.log("\n== 2. 항목·파일별로 묶고 파일 이름을 보임");
{
  const d = detailOf([
    done(1, result("가온에너지공단", "임원연봉", [finding("R10-1")])),
    done(2, result("가온에너지공단", "직원평균보수", [finding("R11-1")])),
  ], "가온에너지공단");
  check(d.groups.length === 2, "항목 종류별로 두 묶음");
  check(d.groups.map((g) => g.itemType).join() === "임원연봉,직원평균보수" && d.groups.some((g) => g.fileName === "가온_직원평균보수.pdf"), "묶음마다 항목 종류와 파일 이름이 있음", d.groups.map((g) => `${g.itemType}:${g.fileName}`).join(" / "));
}

console.log("\n== 3. 의심 항목이 없으면 '이상 없음'이라 쓰지 않음");
{
  const d = detailOf([done(1, result("가온에너지공단", "임원연봉")), done(2, result("가온에너지공단", "직원평균보수"))], "가온에너지공단");
  check(d.groups.length === 0 && d.emptyMessage.startsWith("발견된 의심 항목 없음") && d.emptyMessage.includes("담당자 확인"), "발견된 의심 항목 없음 + 담당자 확인 필요 문구", d.emptyMessage);
  check(!d.emptyMessage.includes("이상 없음"), "'이상 없음'이라고 쓰지 않음");
}

console.log("\n== 4. 순위에서 제외된 기관은 '의심 항목 없음'이라 쓰지 않음");
{
  const d = detailOf([
    done(1, result("가온에너지공단", "임원연봉", [finding()])),
    done(3, result("새기관", "임원연봉", [finding()])),
    done(4, result("새기관", "임원연봉", [finding()])),
  ], "새기관");
  check(d.rank === null && !d.emptyMessage.startsWith("발견된 의심 항목 없음") && d.note.includes("중복 선택 필요"), "중복 미해결 기관은 순위 제외 안내와 '중복 선택 필요'를 보임", d.emptyMessage);
}

console.log("\n== 5. 근거를 댈 수 없는 지적은 보이지 않음");
{
  const d = detailOf([done(1, result("가온에너지공단", "임원연봉", [finding("R10-1"), finding("R99-9")]))], "가온에너지공단");
  check(d.groups[0].items.length === 1 && d.groups[0].items[0].ruleId === "R10-1", "체크리스트에 없는 기준 번호의 지적은 뺌");
}

console.log("\n== 6. 안내(note) 전달");
{
  const d = detailOf([done(1, result("가온에너지공단", "임원연봉", [finding()]))], "가온에너지공단");
  check(d.note === "업로드되지 않음: 직원평균보수", "업로드되지 않은 항목 안내가 함께 나옴", d.note);
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
