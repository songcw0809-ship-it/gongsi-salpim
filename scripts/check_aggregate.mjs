// 결과 모으기 규칙(lib/aggregate.ts)이 PRD 규칙대로 동작하는지 확인한다.
//
// 실행:  node scripts/check_aggregate.mjs
// AI 호출 없이, samples/answer-key.json 의 기관·항목 정보로 분류가 끝난 파일을 흉내 내어 시험한다.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LABEL, normalizeInstitution, normalizeItemType, organize, slotKey } from "../lib/aggregate.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const key = JSON.parse(readFileSync(join(ROOT, "samples", "answer-key.json"), "utf-8"));
const REQUIRED = ["임원연봉", "직원평균보수"];

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const ok = (fileName, institution, itemType) => ({ fileName, status: "ok", institution, itemType });
const base = key.files.map((f) => ok(f.file, f.institution, f.itemType));
const find = (res, inst) => res.institutions.find((g) => g.institution === inst);
const slot = (g, t) => g.slots.find((s) => s.itemType === t);

console.log("== 1. 정상 12개");
{
  const r = organize(base, REQUIRED);
  check(r.institutions.length === 6, "기관 6곳으로 묶임", r.institutions.map((g) => g.institution).join(", "));
  check(r.institutions.every((g) => g.slots.every((s) => s.status === "uploaded")), "모든 칸이 정상 업로드");
  check(r.files.every((f) => f.state === "ready"), "파일 12개 모두 정상 상태");
  check(r.unassigned.length === 0 && r.institutions.every((g) => !g.hasUnresolvedDuplicate), "미확인·중복 없음");
  const names = r.institutions.map((g) => g.institution);
  check(names.join() === [...names].sort((a, b) => a.localeCompare(b, "ko")).join(), "기관명 가나다순");
}

console.log("\n== 2. 중복 (가온 임원연봉 복사본 추가)");
{
  const dupName = "가온에너지공단_임원연봉(복사).pdf";
  const files = [...base, ok(dupName, "가온에너지공단", "임원연봉")];
  const r = organize(files, REQUIRED);
  const g = find(r, "가온에너지공단");
  check(slot(g, "임원연봉").status === "duplicate" && slot(g, "임원연봉").label === LABEL.duplicate, "칸이 '중복'");
  const dups = r.files.filter((f) => f.state === "duplicate").map((f) => f.fileName);
  check(dups.length === 2 && dups.includes(dupName) && dups.includes("가온에너지공단_임원연봉.pdf"), "원본과 복사본 둘 다 '중복'", dups.join(" / "));
  check(g.hasUnresolvedDuplicate === true, "고르기 전에는 순위 제외 대상으로 표시");
  check(find(r, "누리항공공사").hasUnresolvedDuplicate === false, "다른 기관은 영향 없음");

  const choice = { [slotKey("가온에너지공단", "임원연봉")]: "가온에너지공단_임원연봉.pdf" };
  const r2 = organize(files, REQUIRED, choice);
  const g2 = find(r2, "가온에너지공단");
  check(g2.hasUnresolvedDuplicate === false && slot(g2, "임원연봉").chosen === "가온에너지공단_임원연봉.pdf", "고르면 중복이 해소됨");
  const st = Object.fromEntries(r2.files.map((f) => [f.fileName, f.state]));
  check(st["가온에너지공단_임원연봉.pdf"] === "ready" && st[dupName] === "excluded", "고른 파일은 정상, 나머지는 '쓰지 않음'");
}

console.log("\n== 3. 업로드되지 않음 (한빛 직원평균보수 빠짐)");
{
  const files = base.filter((f) => f.fileName !== "한빛에너지공사_직원평균보수.pdf");
  const r = organize(files, REQUIRED);
  const s = slot(find(r, "한빛에너지공사"), "직원평균보수");
  check(s.status === "missing" && s.label === "업로드되지 않음", "칸이 '업로드되지 않음'");
  check(!s.label.includes("미제출"), "'미제출'이라고 단정하지 않음");
  check(slot(find(r, "한빛에너지공사"), "임원연봉").status === "uploaded", "올린 칸은 정상");
}

console.log("\n== 4. 기관 미확인 / 항목 종류 미확인");
{
  const files = [...base, ok("이름없음_임원연봉.pdf", null, "임원연봉"), ok("종류모름.pdf", "한빛에너지공사", null)];
  const r = organize(files, REQUIRED);
  const a = r.files.find((f) => f.fileName === "이름없음_임원연봉.pdf");
  const b = r.files.find((f) => f.fileName === "종류모름.pdf");
  check(a.state === "unclassified" && a.institutionLabel === LABEL.unknownInstitution, "기관 없음 → '기관 미확인'");
  check(b.state === "unclassified" && b.itemTypeLabel === LABEL.unknownItemType, "항목 종류 없음 → '항목 종류 미확인'");
  check(r.unassigned.length === 2 && r.institutions.length === 6, "둘 다 기관별 묶음에서 빠지고 별도 목록으로");
  check(slot(find(r, "한빛에너지공사"), "직원평균보수").status === "uploaded", "미확인 파일이 다른 칸을 건드리지 않음");
}

console.log("\n== 5. 처리 불가·점검 실패 파일");
{
  const files = [
    ...base,
    { fileName: "스캔본.pdf", status: "unreadable", institution: null, itemType: null, reason: "글자를 읽을 수 없음" },
    { fileName: "깨진파일.pdf", status: "failed", institution: null, itemType: null, reason: "PDF를 읽는 중 오류" },
  ];
  const r = organize(files, REQUIRED);
  const s = r.files.find((f) => f.fileName === "스캔본.pdf");
  const f = r.files.find((x) => x.fileName === "깨진파일.pdf");
  check(s.state === "unreadable" && s.note === "글자를 읽을 수 없음", "스캔본 → 처리 불가 표시");
  check(f.state === "failed", "손상된 파일 → 점검 실패 표시");
  check(r.institutions.length === 6 && r.unassigned.length === 0, "다른 파일은 그대로 정상 처리 (나머지는 계속 점검)");
}

console.log("\n== 6. 이름 정리 (AI 답을 믿지 않고 다듬기)");
{
  check(normalizeInstitution("  한빛   에너지공사 ") === "한빛 에너지공사", "기관명 공백 정리");
  check(normalizeInstitution("   ") === null && normalizeInstitution(null) === null, "빈 기관명 → null");
  check(normalizeItemType("임원 연봉", REQUIRED) === "임원연봉", "'임원 연봉' → 임원연봉");
  check(normalizeItemType("직원 평균보수", REQUIRED) === "직원평균보수", "'직원 평균보수' → 직원평균보수");
  check(normalizeItemType("복리후생비", REQUIRED) === null, "목록에 없는 항목 종류는 지어내지 않고 null");
  const files = [ok("a.pdf", "한빛에너지공사", "임원연봉"), ok("b.pdf", "한빛 에너지공사", "직원평균보수")];
  const r = organize(files, REQUIRED);
  check(r.institutions.length === 1, "띄어쓰기만 다른 기관명은 같은 기관", r.institutions.map((g) => g.institution).join(", "));
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
