// 기관별 요약과 순위 계산(lib/aggregate.ts 의 summarize)이 PRD·DESIGN 규칙대로 동작하는지 확인한다.
//
// 실행:  node scripts/check_summary.mjs
// AI 호출 없이, samples/answer-key.json 의 정답(기관별 오류)을 점검 결과처럼 만들어 시험한다.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RANK_BASIS, slotKey, summarize } from "../lib/aggregate.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const key = JSON.parse(readFileSync(join(ROOT, "samples", "answer-key.json"), "utf-8"));
const REQUIRED = ["임원연봉", "직원평균보수"];

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const finding = (ruleId, confidence = "높음") => ({
  ruleId, message: "오류 가능성: 시험용", confidence, evidence: { quote: "임원 보수 현황", location: "1쪽" },
});
const result = (fileName, institution, itemType, findings = [], status = "ok") => ({
  fileName, status, institution, itemType, extracted: [], findings, elapsedMs: 1, model: "gpt-6.1-sol",
});
const fromKey = (f, confidence = "높음") => result(f.file, f.institution, f.itemType, f.errors.map((e) => finding(e.ruleId, confidence)));

const base = key.files.map((f) => fromKey(f));
const names = (s) => s.institutions.map((i) => i.institution);
const row = (s, name) => s.institutions.find((i) => i.institution === name);

console.log("== 1. 정답지 12개: 정답 순위와 같은가");
{
  const s = summarize(base, REQUIRED);
  console.log("   " + s.institutions.map((i) => `${i.rank}.${i.institution}(높음${i.highCount}/전체${i.findingCount})`).join("  "));
  check(s.institutions.map((i) => i.rank).join() === "1,2,3,4,5,6", "순위가 1~6으로 이어짐");
  check(names(s).slice(0, 3).join() === key.expectedTop3.join(), "상위 3곳이 정답과 같음 (가온 · 누리 · 바른)", names(s).slice(0, 3).join(", "));
  const hits = names(s).slice(0, 3).filter((n) => key.expectedTop3.includes(n)).length;
  check(hits >= 2, `우선순위 정확도: 상위 3곳 중 ${hits}곳 일치 (목표 2곳 이상)`);
  check(names(s).join() === "가온에너지공단,누리항공공사,바른주택공사,미래철도공사,푸른물관리공단,한빛에너지공사", "전체 순서, 동점(오류 1개씩)인 미래·푸른은 가나다순으로 미래가 먼저");
  check(s.institutions.every((i) => i.highCount === key.errorsByInstitution[i.institution]), "기관별 지적 수가 정답지의 심은 오류 수와 같음");
  check(row(s, "한빛에너지공사").findingCount === 0 && row(s, "한빛에너지공사").rank === 6, "오류 0개인 기관도 순위에 들어감 (마지막)");
  check(s.rankBasis === RANK_BASIS && s.rankBasis.includes("신뢰도 높음") && s.rankBasis.includes("가나다"), "순위 기준 문구가 결과에 함께 들어감", s.rankBasis);
  check(row(s, "가온에너지공단").findings.length === 4 && row(s, "가온에너지공단").findings.every((x) => x.fileName.startsWith("가온")), "상세 화면용 지적이 파일 이름과 함께 모임");
}

console.log("\n== 2. 순위 기준: 높음 수 → 전체 의심 항목 수 → 기관명");
{
  const mid = summarize([
    result("a.pdf", "푸른기관", "임원연봉", [finding("R10-1", "높음")]),
    result("b.pdf", "미래기관", "임원연봉", [finding("R10-1", "중간")]),
  ], REQUIRED);
  check(names(mid).join() === "푸른기관,미래기관", "높음 지적이 많으면 이름이 뒤여도 앞섬 (신뢰도가 우선)");

  const total = summarize([
    result("a.pdf", "가기관", "임원연봉", [finding("R10-1"), finding("R10-2")]),
    result("b.pdf", "나기관", "임원연봉", [finding("R10-1"), finding("R10-2"), finding("R10-3", "낮음"), finding("R10-4", "낮음"), finding("R10-5", "낮음")]),
  ], REQUIRED);
  check(names(total).join() === "나기관,가기관", "높음이 같으면 전체 의심 항목이 많은 쪽이 앞섬");

  const name = summarize([
    result("b.pdf", "나기관", "임원연봉", [finding("R10-1")]),
    result("a.pdf", "가기관", "임원연봉", [finding("R10-2")]),
  ], REQUIRED);
  check(names(name).join() === "가기관,나기관", "그래도 같으면 기관명 가나다순");
  check(row(name, "가기관").countsByConfidence["높음"] === 1, "신뢰도별 지적 수가 기록됨");
}

console.log("\n== 3. 중복: 고르기 전에는 순위에서 빼고, 고르면 다시 계산");
{
  const dupFile = key.files.find((f) => f.file === "가온에너지공단_임원연봉.pdf");
  const dup = result("가온에너지공단_임원연봉(복사).pdf", dupFile.institution, dupFile.itemType, dupFile.errors.map((e) => finding(e.ruleId)));
  const files = [...base, dup];

  const s = summarize(files, REQUIRED);
  const g = row(s, "가온에너지공단");
  check(g.hasUnresolvedDuplicate && g.note.includes("중복 선택 필요"), "기관 행에 '중복 선택 필요' 표시", g.note);
  check(g.highCount === 2 && g.findingCount === 2, "중복 칸의 지적은 세지 않음 (4개가 아니라 직원평균보수의 2개만)", `높음 ${g.highCount} / 전체 ${g.findingCount}`);
  check(g.findings.every((x) => x.itemType === "직원평균보수"), "상세에 쓸 지적에서도 중복 칸이 빠짐");
  check(names(s).join() === "누리항공공사,가온에너지공단,바른주택공사,미래철도공사,푸른물관리공단,한빛에너지공사", "가온이 1위에서 2위로 내려감 (바른과 같은 2·2는 가나다순)");

  const choice = { [slotKey("가온에너지공단", "임원연봉")]: "가온에너지공단_임원연봉.pdf" };
  const r = summarize(files, REQUIRED, choice);
  check(row(r, "가온에너지공단").rank === 1 && row(r, "가온에너지공단").highCount === 4 && !row(r, "가온에너지공단").hasUnresolvedDuplicate, "하나를 고르면 4개가 다시 세어져 1위로 돌아옴 (복사본은 중복 세지 않음)");
  const dupState = r.files.find((f) => f.fileName.includes("(복사)"));
  check(dupState.state === "excluded", "고르지 않은 파일은 '쓰지 않음'");
}

console.log("\n== 4. 순위에서 제외되는 기관 (점검 결과를 쓸 수 없는 경우)");
{
  const x = (n) => result(`${n}.pdf`, "새기관", "임원연봉", [finding("R10-1")]);
  const s = summarize([...base, x("n1"), x("n2")], REQUIRED);
  const n = row(s, "새기관");
  check(n.rank === null && n.highCount === 0, "전부 중복 미해결인 기관은 순위 없음(null)", n.note);
  check(s.institutions[s.institutions.length - 1].institution === "새기관" && s.institutions.slice(0, 6).every((i) => i.rank !== null), "순위 없는 기관은 순위 있는 기관들 뒤에 둠");
  check(row(s, "가온에너지공단").rank === 1, "다른 기관의 순위에는 영향 없음");
  const solved = summarize([...base, x("n1"), x("n2")], REQUIRED, { [slotKey("새기관", "임원연봉")]: "n1.pdf" });
  check(row(solved, "새기관").rank !== null, "하나를 고르면 순위가 생김");
}

console.log("\n== 5. 업로드되지 않음 / 미확인 / 처리 불가는 순위에 영향 없음");
{
  const s = summarize(base.filter((r) => r.fileName !== "한빛에너지공사_직원평균보수.pdf"), REQUIRED);
  const h = row(s, "한빛에너지공사");
  check(h.rank === 6 && h.missingItemTypes.join() === "직원평균보수" && h.note === "업로드되지 않음: 직원평균보수", "빠진 항목은 '업로드되지 않음'으로 알리되 순위는 유지", h.note);
  check(!h.note.includes("미제출"), "'미제출'이라고 단정하지 않음");

  const extra = [
    ...base,
    result("이름없음.pdf", null, "임원연봉", [finding("R10-1")]),
    result("종류모름.pdf", "가온에너지공단", null, [finding("R10-1")]),
    { ...result("스캔본.pdf", null, null, [], "unreadable"), reason: "글자를 읽을 수 없음" },
    { ...result("깨짐.pdf", null, null, [], "failed"), reason: "점검 실패" },
  ];
  const e = summarize(extra, REQUIRED);
  check(names(e).join() === names(summarize(base, REQUIRED)).join() && row(e, "가온에너지공단").highCount === 4, "미확인·처리 불가·점검 실패 파일이 순위와 지적 수를 바꾸지 않음");
  check(e.unassigned.length === 2 && e.files.length === extra.length, "미확인 파일은 별도 목록에, 모든 파일의 화면 상태가 나옴");
}

console.log("\n== 6. 빈 입력");
{
  const s = summarize([], REQUIRED);
  check(s.institutions.length === 0 && s.files.length === 0 && s.rankBasis === RANK_BASIS, "파일이 없으면 빈 결과");
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
