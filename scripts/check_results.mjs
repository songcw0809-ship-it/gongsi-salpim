// 결과 표(lib/result-view.ts)가 PRD 5번 M1·DESIGN §1.2 ② 대로 줄을 만드는지 확인한다.
//
// 실행:  node scripts/check_results.mjs
// AI 호출·화면 없이 시험한다.

import { buildResultRows } from "../lib/result-view.ts";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const finding = (confidence = "높음") => ({
  ruleId: "R10-1", message: "오류 가능성: 시험용", confidence, evidence: { quote: "임원 보수 현황", location: "1쪽" },
});
const result = (institution, itemType, findings = [], extra = {}) => ({
  fileName: "x", status: "ok", institution, itemType, extracted: [{ label: "기본급", value: "100", location: "1쪽" }],
  findings, elapsedMs: 1, model: "gpt-6.1-sol", ...extra,
});
const done = (id, fileName, r) => ({ id, fileName, phase: "done", result: r });
const row = (rows, id) => rows.find((r) => r.id === id);

console.log("== 1. 정상 파일: 기관·항목·추출한 값·의심 항목 수");
{
  const rows = buildResultRows([done(1, "한빛.pdf", result("한빛에너지공사", "임원연봉", [finding(), finding("중간")]))]);
  const r = rows[0];
  check(r.institution === "한빛에너지공사" && r.itemType === "임원연봉" && r.state === "ready" && r.stateLabel === "완료", "기관·항목 종류·상태(완료)가 나옴");
  check(r.note === "오류 가능성 2건 (신뢰도 높음 1건)", "의심 항목 수가 한 줄로 나옴", r.note);
  check(r.extracted.length === 1 && r.extracted[0].label === "기본급", "추출한 값이 줄에 들어감");
  check(!r.canRetry && !r.canChoose, "다시 시도·고르기 버튼은 없음");
  const none = buildResultRows([done(1, "a.pdf", result("한빛에너지공사", "임원연봉"))])[0];
  check(none.note.startsWith("발견된 의심 항목 없음") && !none.note.includes("이상 없음"), "의심 항목이 없어도 '이상 없음'이라 쓰지 않음", none.note);
}

console.log("\n== 2. 기관 미확인·항목 종류 미확인");
{
  const rows = buildResultRows([
    done(1, "이름없음.pdf", result(null, "임원연봉", [finding()])),
    done(2, "종류모름.pdf", result("한빛에너지공사", null)),
  ]);
  check(rows[0].institution === "기관 미확인" && rows[0].stateLabel === "완료" && rows[0].state === "unclassified", "기관 미확인으로 표시하고 추측하지 않음");
  check(rows[0].note.includes("순위에 반영되지 않음"), "순위에 반영되지 않는다고 알림", rows[0].note);
  check(rows[1].itemType === "항목 종류 미확인", "항목 종류 미확인으로 표시");
}

console.log("\n== 3. 중복: 둘 다 중복으로 표시, 고르면 해소");
{
  const files = [
    done(1, "가온_임원연봉.pdf", result("가온에너지공단", "임원연봉", [finding()])),
    done(2, "가온_임원연봉(복사).pdf", result("가온에너지공단", "임원연봉", [finding()])),
    done(3, "가온_직원.pdf", result("가온에너지공단", "직원평균보수")),
  ];
  const before = buildResultRows(files);
  check(row(before, 1).state === "duplicate" && row(before, 2).state === "duplicate" && row(before, 3).state === "ready", "같은 기관·같은 항목의 두 파일이 모두 '중복', 다른 항목은 정상");
  check(row(before, 1).canChoose && row(before, 2).canChoose && !row(before, 3).canChoose, "중복 파일에만 고르기 버튼");
  const key = row(before, 1).choiceKey;
  check(typeof key === "string" && key === row(before, 2).choiceKey, "두 파일의 고르기 열쇠가 같음");

  const after = buildResultRows(files, { [key]: "2" });
  check(row(after, 2).state === "ready" && row(after, 2).isChosen && row(after, 2).note.startsWith("사용할 파일로 선택됨"), "고른 파일은 정상으로 돌아오고 선택됐다고 표시", row(after, 2).note);
  check(row(after, 1).state === "excluded" && row(after, 1).stateLabel === "쓰지 않음" && !row(after, 1).canChoose, "고르지 않은 파일은 '쓰지 않음'");
}

console.log("\n== 4. 같은 이름의 파일이 둘이어도 번호로 구분");
{
  const files = [
    done(1, "같은이름.pdf", result("누리항공공사", "임원연봉")),
    done(2, "같은이름.pdf", result("누리항공공사", "임원연봉")),
  ];
  const rows = buildResultRows(files);
  check(rows.every((r) => r.state === "duplicate"), "이름이 같아도 둘 다 중복으로 잡힘");
  const picked = buildResultRows(files, { [rows[0].choiceKey]: "1" });
  check(row(picked, 1).state === "ready" && row(picked, 2).state === "excluded", "번호 1을 고르면 1만 쓰고 2는 쓰지 않음 (이름으로는 구분 못 함)");
}

console.log("\n== 5. 처리 불가·점검 실패·진행 중");
{
  const rows = buildResultRows([
    done(1, "스캔.pdf", result(null, null, [], { status: "unreadable", reason: "글자를 읽을 수 없음", extracted: [] })),
    done(2, "실패.pdf", result("한빛에너지공사", "임원연봉", [], { status: "failed", reason: "AI 호출 실패 (500)", extracted: [] })),
    { id: 3, fileName: "연결안됨.pdf", phase: "error", reason: "서버에 연결할 수 없음" },
    { id: 4, fileName: "점검중.pdf", phase: "running" },
    { id: 5, fileName: "대기.pdf", phase: "waiting" },
  ]);
  check(row(rows, 1).stateLabel === "처리 불가" && row(rows, 1).note === "글자를 읽을 수 없음" && !row(rows, 1).canRetry, "스캔본: 처리 불가, 이유 표시, 다시 시도 없음");
  check(row(rows, 2).stateLabel === "점검 실패" && row(rows, 2).canRetry && row(rows, 2).note === "AI 호출 실패 (500)", "AI 호출 실패: 점검 실패 + 다시 시도 가능");
  check(row(rows, 3).stateLabel === "점검 실패" && row(rows, 3).canRetry && row(rows, 3).note === "서버에 연결할 수 없음", "서버 연결 실패도 점검 실패 + 다시 시도 가능");
  check(row(rows, 4).stateLabel === "점검 중" && row(rows, 5).stateLabel === "대기", "아직 결과가 없는 파일은 대기·점검 중");
  check(row(rows, 2).extracted.length === 0, "실패한 파일은 추출한 값이 비어 있음");
  check(rows.map((r) => r.id).join() === "1,2,3,4,5", "입력 순서를 지킴");
}

console.log("\n== 6. 실패한 파일을 다시 시도해 성공하면 그 파일만 바뀜");
{
  const failed = { id: 2, fileName: "b.pdf", phase: "done", result: result("누리항공공사", "임원연봉", [], { status: "failed", reason: "x", extracted: [] }) };
  const ok = done(1, "a.pdf", result("한빛에너지공사", "임원연봉", [finding()]));
  const before = buildResultRows([ok, failed]);
  const after = buildResultRows([ok, done(2, "b.pdf", result("누리항공공사", "임원연봉", [finding()]))]);
  check(row(before, 2).canRetry && !row(after, 2).canRetry && row(after, 2).state === "ready", "다시 시도에 성공하면 정상 줄로 바뀜");
  check(JSON.stringify(row(before, 1)) === JSON.stringify(row(after, 1)), "다른 파일의 줄은 그대로");
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
