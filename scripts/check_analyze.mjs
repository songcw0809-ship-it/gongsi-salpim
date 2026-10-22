// AI 점검 서버 코드(lib/check-file.ts, lib/ai/*)가 PRD 규칙대로 동작하는지 확인한다.
//
// 실행:  node scripts/check_analyze.mjs                         # 가짜 AI로 전체 흐름 시험 (비용 없음)
//        node scripts/check_analyze.mjs --live                  # 진짜 AI를 3개 파일에 불러 본다 (소액 비용)
//        node scripts/check_analyze.mjs --live --model gpt-6-luna
//
// 가짜 AI는 정답지를 알고 "완벽한 답 + 지어낸 답"을 섞어 돌려준다. 그래서 검증 장치가
// 지어낸 것을 걸러 내는지까지 함께 볼 수 있다.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkFile, ITEM_TYPES } from "../lib/check-file.ts";
import { MODELS, defaultModel, resolveModel } from "../lib/ai/models.ts";
import { renderDocument, classifyPrompt, checkPrompt } from "../lib/ai/prompts.ts";
import { rulesFor } from "../lib/checklist.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = join(ROOT, "samples");
const key = JSON.parse(readFileSync(join(SAMPLES, "answer-key.json"), "utf-8"));
const argv = process.argv.slice(2);
const MODEL = defaultModel({});

// 파일에 실제로 있는 문구 (check_guard.mjs 와 같다)
const QUOTE = {
  "R10-1": "임원 보수 현황", "R10-3": "임원 보수 현황", "R10-4": "임원 보수 현황", "R10-5": "임원 보수 현황", "R10-6": "임원 보수 현황",
  "R10-7": "기준 시점: 2026년 6월 30일 기준",
  "R11-2": "직원 1인당 평균 보수", "R11-3": "직원 평균근속연수", "R11-4": "직원 1인당 평균 보수",
  "C-1": "공시 기간: 2024년 ~ 2025년 (2개년)", "C-2": "공시일: 2026-06-15",
};

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const bytesOf = (path) => new Uint8Array(readFileSync(path));

/** 정답지를 아는 가짜 AI. 호출 기록을 남긴다. */
function fakeAi(file, opts = {}) {
  const calls = [];
  return {
    calls,
    async json(req) {
      calls.push(req);
      if (opts.fail) {
        const e = new Error("요청 내용 sk-비밀키 가 섞인 내부 오류");
        e.status = 500;
        throw e;
      }
      const usage = { inputTokens: 100, outputTokens: 50 };
      if (req.schemaName === "classify_extract") {
        const date = /공시일: (\S+)/.exec(req.user)?.[1] ?? "";
        return {
          data: {
            institution: "institution" in opts ? opts.institution : file.institution,
            itemType: "itemType" in opts ? opts.itemType : file.itemType,
            extracted: [
              { label: "공시일", value: date, location: "9쪽" },
              { label: "지어낸 값", value: "999,999,999", location: "1쪽" },
              { label: "비어 있음", value: "", location: "1쪽" },
            ],
          },
          usage,
        };
      }
      const truth = file.errors.map((e) => ({
        ruleId: e.ruleId, message: "해당 항목이 없어 명백히 오류입니다.", confidence: "높음", quote: QUOTE[e.ruleId], location: "9쪽",
      }));
      const wrong = new Set(file.errors.map((e) => e.ruleId));
      const other = rulesFor(file.itemType).find((r) => !wrong.has(r.id));
      const fakes = [
        { ruleId: "R99-9", message: "없는 기준", confidence: "높음", quote: "임원 보수 현황", location: "1쪽" },
        ...(other ? [{ ruleId: other.id, message: "지어낸 지적", confidence: "높음", quote: "지어낸 근거 문장 파일에는 없음", location: "1쪽" }] : []),
      ];
      return { data: { findings: [...truth, ...fakes] }, usage };
    },
  };
}

if (!argv.includes("--live")) {
  console.log("== 1. 모델 허용 목록");
  {
    check(MODELS.map((m) => m.id).join() === "gpt-6.1-sol,gpt-6-luna,gpt-6-astra", "허용 모델 3개", MODELS.map((m) => m.id).join(", "));
    check(defaultModel({}) === "gpt-6.1-sol", "기본값은 gpt-6.1-sol");
    check(resolveModel("gpt-6-luna", {}) === "gpt-6-luna" && resolveModel("gpt-6-astra", {}) === "gpt-6-astra", "허용된 모델은 그대로");
    check(resolveModel(undefined, {}) === "gpt-6.1-sol" && resolveModel("", {}) === "gpt-6.1-sol", "비어 있으면 기본 모델");
    check(resolveModel("gpt-4", {}) === null && resolveModel("gpt-6-luna; drop", {}) === null && resolveModel(123, {}) === null, "허용 목록에 없는 이름은 거절(null)");
    check(defaultModel({ OPENAI_MODEL: "gpt-6-luna" }) === "gpt-6-luna", "OPENAI_MODEL이 허용 모델이면 기본값을 바꿈");
    check(defaultModel({ OPENAI_MODEL: "아무모델" }) === "gpt-6.1-sol", "OPENAI_MODEL이 허용 목록에 없으면 무시");
    let threw = false;
    try { await checkFile({ fileName: "a.pdf", bytes: new Uint8Array(), model: "gpt-4", ai: fakeAi(key.files[0]) }); } catch { threw = true; }
    check(threw, "허용되지 않은 모델로는 점검을 시작하지 않음 (AI 호출 전에 거절)");
    check(ITEM_TYPES.join() === "임원연봉,직원평균보수", "항목 종류는 체크리스트에서 가져옴", ITEM_TYPES.join(", "));
  }

  console.log("\n== 2. 질문 만들기");
  {
    const units = [{ location: "1쪽", text: "임원 보수 현황" }];
    const c = classifyPrompt(units, ITEM_TYPES);
    check(c.user.includes("[1쪽]") && c.system.includes("임원연봉") && c.system.includes("null"), "분류 질문에 문서 위치 표시와 항목 종류 목록, null 규칙이 들어감");
    const k = checkPrompt(units, rulesFor("임원연봉"));
    check(k.user.includes("R10-1") && k.user.includes("C-2") && !k.user.includes("R11-1"), "대조 질문에 이 항목의 기준과 공통 기준만 들어감");
    check(k.system.includes("그대로 복사") && k.system.includes("단정하지"), "인용문 복사와 단정 금지 지시가 들어감");
    check(renderDocument(units) === "[1쪽]\n임원 보수 현황", "문서 표시 형식");
  }

  console.log("\n== 3. 샘플 12개: 가짜 AI의 지어낸 답은 걸러지고 정답만 남는지");
  let tokensIn = 0;
  for (const f of key.files) {
    const ai = fakeAi(f);
    const r = await checkFile({ fileName: f.file, bytes: bytesOf(join(SAMPLES, f.file)), model: MODEL, ai });
    const got = r.findings.map((x) => x.ruleId).sort().join();
    const want = f.errors.map((e) => e.ruleId).sort().join();
    tokensIn += r.usage?.inputTokens ?? 0;
    const date = r.extracted.find((x) => x.label === "공시일");
    const made = r.extracted.find((x) => x.label === "지어낸 값");
    const blank = r.extracted.find((x) => x.label === "비어 있음");
    const ok =
      r.status === "ok" && r.institution === f.institution && r.itemType === f.itemType && got === want &&
      r.model === MODEL && ai.calls.length === 2 && date?.location === "1쪽" && made?.value === "추출 불가" && blank?.value === "추출 불가" &&
      r.findings.every((x) => x.message.startsWith("오류 가능성") && !x.message.includes("오류입니다") && x.evidence.location === "1쪽");
    check(ok, f.file, `지적 [${got || "-"}] · AI ${ai.calls.length}번 · ${r.elapsedMs}ms`);
  }
  check(tokensIn === 12 * 2 * 100, "토큰 사용량이 두 번의 호출을 합쳐 기록됨 (12개 × 2번 × 100)", `입력 합계 ${tokensIn}`);

  console.log("\n== 4. 예외 상황");
  {
    const scanAi = fakeAi(key.files[0]);
    const scan = await checkFile({ fileName: "스캔본_임원연봉.pdf", bytes: bytesOf(join(SAMPLES, "exceptions", "스캔본_임원연봉.pdf")), model: MODEL, ai: scanAi });
    check(scan.status === "unreadable" && scan.reason === "글자를 읽을 수 없음" && scanAi.calls.length === 0, "스캔본 → 글자를 읽을 수 없음, AI는 부르지 않음 (비용 절약)");

    const f = key.files[10]; // 가온 임원연봉
    const noName = await checkFile({ fileName: "이름없음_임원연봉.pdf", bytes: bytesOf(join(SAMPLES, "exceptions", "이름없음_임원연봉.pdf")), model: MODEL, ai: fakeAi({ ...f, errors: [] }, { institution: null }) });
    check(noName.status === "ok" && noName.institution === null, "기관명이 없으면 null (기관 미확인), 추측하지 않음");

    const unk = fakeAi(f, { itemType: "복리후생비" });
    const unknown = await checkFile({ fileName: f.file, bytes: bytesOf(join(SAMPLES, f.file)), model: MODEL, ai: unk });
    check(unknown.itemType === null && unknown.findings.length === 0 && unk.calls.length === 1, "AI가 모르는 항목 종류를 지어내면 null, 대조는 건너뜀 (AI 1번만 호출)");

    const failAi = fakeAi(f, { fail: true });
    const failed = await checkFile({ fileName: f.file, bytes: bytesOf(join(SAMPLES, f.file)), model: MODEL, ai: failAi });
    check(failed.status === "failed" && failed.reason === "AI 호출 실패 (500)", "AI 호출이 실패하면 그 파일만 '점검 실패'", failed.reason);
    check(!JSON.stringify(failed).includes("sk-"), "오류 안에 있던 비밀 문구가 결과로 새지 않음");

    const bad = await checkFile({ fileName: "깨진.pdf", bytes: new Uint8Array(Buffer.from("PDF 아님")), model: MODEL, ai: fakeAi(f) });
    check(bad.status === "failed", "손상된 파일 → 점검 실패");

    const wrongExt = await checkFile({ fileName: "문서.hwp", bytes: new Uint8Array([1, 2, 3]), model: MODEL, ai: fakeAi(f) });
    check(wrongExt.status === "failed" && wrongExt.reason === "지원하지 않는 파일 형식", ".hwp 같은 형식은 점검하지 않음");
  }

  console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
  process.exit(failures === 0 ? 0 : 1);
}

// --- 진짜 AI 시험 (--live) ---------------------------------------------------
// .env 에서 OPENAI_API_KEY 를 읽는다. 값은 화면에 출력하지 않는다.
const { createOpenAiClientFromEnv } = await import("../lib/ai/openai.ts");
try {
  const env = readFileSync(join(ROOT, ".env"), "utf-8");
  for (const line of env.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  /* .env 가 없으면 이미 설정된 환경변수를 쓴다 */
}
const modelArg = argv[argv.indexOf("--model") + 1];
const model = resolveModel(argv.includes("--model") ? modelArg : undefined) ?? (() => { console.log("허용되지 않은 모델:", modelArg); process.exit(1); })();
const ai = createOpenAiClientFromEnv();
const targets = ["가온에너지공단_임원연봉.pdf", "가온에너지공단_직원평균보수.pdf", "한빛에너지공사_임원연봉.pdf"];

console.log(`== 진짜 AI 시험: 모델 ${model}, 파일 ${targets.length}개 (AI 호출 ${targets.length * 2}번)\n`);
for (const name of targets) {
  const f = key.files.find((x) => x.file === name);
  const r = await checkFile({ fileName: name, bytes: bytesOf(join(SAMPLES, name)), model, ai });
  const got = r.findings.map((x) => x.ruleId).sort();
  const want = f.errors.map((e) => e.ruleId).sort();
  const hit = want.filter((id) => got.includes(id)).length;
  console.log(`● ${name}  [${r.status}] ${r.elapsedMs}ms  토큰 ${r.usage?.inputTokens ?? 0}/${r.usage?.outputTokens ?? 0}`);
  if (r.status !== "ok") { console.log("  이유:", r.reason, "\n"); continue; }
  console.log(`  기관: ${r.institution} (정답 ${f.institution}) · 항목: ${r.itemType} (정답 ${f.itemType})`);
  console.log(`  추출한 항목 ${r.extracted.length}개 (추출 불가 ${r.extracted.filter((x) => x.value === "추출 불가").length}개)`);
  console.log(`  지적 [${got.join(", ") || "-"}] / 정답 [${want.join(", ") || "-"}]  → 정답 ${hit}/${want.length} 찾음, 오탐 ${got.filter((id) => !want.includes(id)).length}개`);
  for (const x of r.findings) console.log(`    ${x.ruleId} (${x.confidence}, ${x.evidence.location}) ${x.message}`);
  console.log();
}
