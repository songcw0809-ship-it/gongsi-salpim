// 글자 뽑기(lib/extract)가 샘플 파일에서 제대로 동작하는지 확인한다.
//
// 실행:  node scripts/check_extract.mjs
// 샘플은 python scripts/make_samples.py 로 만든 samples/ 폴더를 쓴다.
// Node 24의 타입 제거 기능으로 .ts 파일을 바로 불러온다.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { extractPdf } from "../lib/extract/pdf.ts";
import { extractExcel } from "../lib/extract/excel.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = join(ROOT, "samples");
const EXC = join(SAMPLES, "exceptions");

// 정상 문서에 들어 있는 문구 (make_samples.py 의 PHRASE 와 같다). 빠진 문구 = 심은 오류.
const PHRASE = {
  "R10-1": "기본급(기본연봉)", "R10-2": "항목별 수당", "R10-3": "급여성 복리후생비",
  "R10-4": "경영평가 성과급", "R10-5": "기타 성과상여금", "R10-6": "임원의 성별 평균보수",
  "R10-7": "결산기준", "R11-1": "경영평가 성과급", "R11-2": "평균 보수(여성)",
  "R11-3": "평균근속연수(여성)", "R11-4": "신입직원 평균보수",
  "C-1": "2021년 ~ 2025년 (5개년)", "C-2": "공시일: 2026-04",
};
const RULES = {
  임원연봉: ["R10-1", "R10-2", "R10-3", "R10-4", "R10-5", "R10-6", "R10-7", "C-1", "C-2"],
  직원평균보수: ["R11-1", "R11-2", "R11-3", "R11-4", "C-1", "C-2"],
};

const norm = (s) => s.replace(/\s/g, "");
const joined = (r) => r.units.map((u) => u.text).join("\n");
let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const key = JSON.parse(readFileSync(join(SAMPLES, "answer-key.json"), "utf-8"));

console.log("== 샘플 PDF 12개: 글자를 뽑아 빠진 문구가 심은 오류와 같은지");
for (const f of key.files) {
  const r = await extractPdf(readFileSync(join(SAMPLES, f.file)));
  if (r.status !== "ok") {
    check(false, f.file, `status=${r.status}`);
    continue;
  }
  const text = norm(joined(r));
  const missing = RULES[f.itemType].filter((id) => !text.includes(norm(PHRASE[id])));
  const expected = f.errors.map((e) => e.ruleId);
  const same = missing.length === expected.length && expected.every((id) => missing.includes(id));
  check(same, f.file, `${r.units.length}쪽 · 글자 ${text.length}자 · 빠진 기준 [${missing.join(", ")}]`);
}

console.log("\n== 예외 파일");
const scan = await extractPdf(readFileSync(join(EXC, "스캔본_임원연봉.pdf")));
check(scan.status === "unreadable" && scan.reason === "글자를 읽을 수 없음", "스캔본 → 글자를 읽을 수 없음", `status=${scan.status}`);

const nameless = await extractPdf(readFileSync(join(EXC, "이름없음_임원연봉.pdf")));
const hasName = nameless.status === "ok" && key.files.some((f) => joined(nameless).includes(f.institution));
check(nameless.status === "ok" && !hasName, "이름없음 → 글자는 읽히고 기관명은 없음", `status=${nameless.status}`);

const dupName = readdirSync(EXC).find((n) => n.includes("(복사)"));
const dup = await extractPdf(readFileSync(join(EXC, dupName)));
const orig = await extractPdf(readFileSync(join(SAMPLES, "가온에너지공단_임원연봉.pdf")));
check(dup.status === "ok" && joined(dup) === joined(orig), "복사본 → 원본과 글자가 같음");

const broken = await extractPdf(new Uint8Array(Buffer.from("이건 PDF가 아닙니다")));
check(broken.status === "failed", "손상된 파일 → 점검 실패로 돌려줌", `status=${broken.status}`);

console.log("\n== 엑셀 (메모리에서 만든 파일)");
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("임원연봉");
ws.getCell("A1").value = "직위";
ws.getCell("B1").value = "기본급(기본연봉)";
ws.getCell("A2").value = "기관장";
ws.getCell("B2").value = 143063;
const xlsx = await extractExcel(new Uint8Array(await wb.xlsx.writeBuffer()));
const locs = xlsx.status === "ok" ? xlsx.units.map((u) => u.location) : [];
check(
  xlsx.status === "ok" && locs.includes("임원연봉!B1") && xlsx.units.find((u) => u.location === "임원연봉!B2")?.text === "143063",
  "엑셀 → 시트명!칸 주소와 글자",
  `위치 ${locs.join(", ")}`,
);
const emptyWb = new ExcelJS.Workbook();
emptyWb.addWorksheet("빈시트");
const empty = await extractExcel(new Uint8Array(await emptyWb.xlsx.writeBuffer()));
check(empty.status === "unreadable", "빈 엑셀 → 글자를 읽을 수 없음", `status=${empty.status}`);
const badXlsx = await extractExcel(new Uint8Array(Buffer.from("엑셀이 아님")));
check(badXlsx.status === "failed", "손상된 엑셀 → 점검 실패로 돌려줌", `status=${badXlsx.status}`);

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
