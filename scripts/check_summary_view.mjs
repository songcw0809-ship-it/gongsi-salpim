// 화면 상태에서 기관별 요약을 만드는 부분(lib/summary-view.ts)이 PRD·DESIGN 규칙대로 동작하는지 확인한다.
//
// 실행:  node scripts/check_summary_view.mjs
// AI 호출·화면 없이 시험한다. 순위 계산 자체는 scripts/check_summary.mjs 가 따로 확인한다.

import { buildSummary } from "../lib/summary-view.ts";
import { slotKey } from "../lib/aggregate.ts";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const finding = (confidence = "높음") => ({
  ruleId: "R10-1", message: "오류 가능성: 시험용", confidence, evidence: { quote: "임원 보수 현황", location: "1쪽" },
});
const result = (institution, itemType, findings = [], extra = {}) => ({
  fileName: "x", status: "ok", institution, itemType, extracted: [], findings, elapsedMs: 1, model: "gpt-6.1-sol", ...extra,
});
const done = (id, r) => ({ id, fileName: `f${id}.pdf`, phase: "done", result: r });
const names = (s) => s.institutions.map((i) => i.institution);
const row = (s, n) => s.institutions.find((i) => i.institution === n);

console.log("== 1. 점검이 끝나기 전에는 요약을 만들지 않음");
{
  check(buildSummary([]) === null, "시작한 파일이 없으면 요약 없음");
  check(buildSummary([done(1, result("가기관", "임원연봉")), { id: 2, fileName: "b.pdf", phase: "running" }]) === null, "점검 중인 파일이 있으면 요약 없음 (끝나지 않은 항목이 '업로드되지 않음'으로 보이는 것을 막음)");
  check(buildSummary([done(1, result("가기관", "임원연봉")), { id: 2, fileName: "b.pdf", phase: "waiting" }]) === null, "대기 중인 파일이 있어도 요약 없음");
  check(buildSummary([done(1, result("가기관", "임원연봉"))]) !== null, "모두 끝나면 요약이 나옴");
}

console.log("\n== 2. 기관별 순위 (신뢰도 높음 → 전체 → 가나다)");
{
  const s = buildSummary([
    done(1, result("가온에너지공단", "임원연봉", [finding(), finding(), finding("중간")])),
    done(2, result("가온에너지공단", "직원평균보수", [finding()])),
    done(3, result("누리항공공사", "임원연봉", [finding()])),
    done(4, result("누리항공공사", "직원평균보수", [finding("낮음")])),
    done(5, result("한빛에너지공사", "임원연봉")),
    done(6, result("한빛에너지공사", "직원평균보수")),
  ]);
  check(names(s).join() === "가온에너지공단,누리항공공사,한빛에너지공사", "높음 3건·1건·0건 순으로 정렬", names(s).join());
  check(s.institutions.map((i) => i.rank).join() === "1,2,3", "순위가 1부터 이어짐");
  const g = row(s, "가온에너지공단");
  check(g.highCount === 3 && g.findingCount === 4, "신뢰도 높음 3건, 전체 4건", `높음 ${g.highCount} / 전체 ${g.findingCount}`);
  check(row(s, "한빛에너지공사").findingCount === 0 && row(s, "한빛에너지공사").rank === 3, "의심 항목이 없는 기관도 순위에 들어감");
  check(s.rankBasis.includes("신뢰도 높음") && s.rankBasis.includes("가나다"), "순위 기준 문구가 함께 나옴");
}

console.log("\n== 3. 파일 번호로 구분: 같은 이름의 파일이 둘이어도 섞이지 않음");
{
  const s = buildSummary([
    { id: 1, fileName: "같은.pdf", phase: "done", result: result("가기관", "임원연봉", [finding()]) },
    { id: 2, fileName: "같은.pdf", phase: "done", result: result("나기관", "임원연봉", [finding(), finding()]) },
  ]);
  check(names(s).join() === "나기관,가기관" && row(s, "나기관").highCount === 2, "이름이 같아도 기관별로 따로 셈");
}

console.log("\n== 4. 중복: 고르기 전에는 순위에서 빼고, 고르면 다시 셈");
{
  const files = [
    done(1, result("가온에너지공단", "임원연봉", [finding(), finding()])),
    done(2, result("가온에너지공단", "임원연봉", [finding(), finding()])),
    done(3, result("가온에너지공단", "직원평균보수", [finding()])),
    done(4, result("누리항공공사", "임원연봉", [finding(), finding()])),
  ];
  const before = buildSummary(files);
  const g = row(before, "가온에너지공단");
  check(g.hasUnresolvedDuplicate && g.note.includes("중복 선택 필요") && g.highCount === 1, "중복 칸의 지적은 세지 않고 '중복 선택 필요' 표시", `${g.note} / 높음 ${g.highCount}`);
  check(names(before)[0] === "누리항공공사", "중복 때문에 가온이 누리 뒤로 내려감");
  const after = buildSummary(files, { [slotKey("가온에너지공단", "임원연봉")]: "2" });
  check(row(after, "가온에너지공단").highCount === 3 && !row(after, "가온에너지공단").hasUnresolvedDuplicate && names(after)[0] === "가온에너지공단", "파일 번호 2를 고르면 3건으로 다시 세고 1위로 돌아옴");
}

console.log("\n== 5. 실패·처리 불가·기관 미확인은 순위에 영향 없음");
{
  const s = buildSummary([
    done(1, result("가온에너지공단", "임원연봉", [finding()])),
    done(2, result(null, "임원연봉", [finding(), finding()])),
    done(3, result("가온에너지공단", "직원평균보수", [], { status: "failed", reason: "AI 호출 실패 (500)" })),
    done(4, result(null, null, [], { status: "unreadable", reason: "글자를 읽을 수 없음" })),
    { id: 5, fileName: "연결안됨.pdf", phase: "error", reason: "서버에 연결할 수 없음" },
  ]);
  check(names(s).join() === "가온에너지공단" && row(s, "가온에너지공단").highCount === 1, "기관 미확인 파일의 지적은 순위에 들어가지 않음");
  check(s.unassigned.join() === "2", "기관 미확인 파일은 별도 목록(파일 번호)에 나옴", s.unassigned.join());
  check(row(s, "가온에너지공단").note.includes("업로드되지 않음: 직원평균보수") && !row(s, "가온에너지공단").note.includes("미제출"), "점검 실패로 빠진 항목은 '업로드되지 않음'이라 쓰고 미제출이라 단정하지 않음", row(s, "가온에너지공단").note);
}

console.log("\n== 6. 쓸 수 있는 결과가 하나도 없는 기관은 순위 없음");
{
  const s = buildSummary([
    done(1, result("가온에너지공단", "임원연봉", [finding()])),
    done(2, result("새기관", "임원연봉", [finding()])),
    done(3, result("새기관", "임원연봉", [finding()])),
  ]);
  check(row(s, "새기관").rank === null && row(s, "가온에너지공단").rank === 1, "전부 중복 미해결인 기관은 순위가 없고 다른 기관의 순위는 그대로");
  check(names(s)[names(s).length - 1] === "새기관", "순위 없는 기관은 맨 뒤");
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
