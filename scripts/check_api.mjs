// 점검 API(lib/api/check-handler.ts, app/api/check/route.ts)가 PRD 규칙대로 답하는지 확인한다.
//
// 실행:  node scripts/check_api.mjs                     # 가짜 AI로 요청 처리 시험 (비용 없음)
//        node scripts/check_api.mjs --http [주소]        # 켜 둔 개발 서버에 실제 요청을 보내 본다
//                                                       #  (기본 주소 http://localhost:3000, 진짜 AI를 한 번 부른다)

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { handleCheck } from "../lib/api/check-handler.ts";
import { CHECK_MAX_DURATION_SECONDS, MAX_FILE_BYTES } from "../lib/limits.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = join(ROOT, "samples");
const key = JSON.parse(readFileSync(join(SAMPLES, "answer-key.json"), "utf-8"));
const argv = process.argv.slice(2);

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const sample = (name) => key.files.find((f) => f.file === name);
const bytesOf = (path) => new Uint8Array(readFileSync(path));

function formOf({ name, bytes, model, noFile = false }) {
  const fd = new FormData();
  if (!noFile) fd.set("file", new File([bytes], name));
  if (model !== undefined) fd.set("model", model);
  return fd;
}
const post = (fd, headers = {}) => new Request("http://localhost/api/check", { method: "POST", body: fd, headers });

/** 정답지를 아는 가짜 AI. 부른 횟수를 센다. */
function fakeAi(file, { fail = false } = {}) {
  const calls = [];
  return {
    calls,
    async json(req) {
      calls.push(req.model);
      if (fail) {
        const e = new Error("내부 오류 sk-비밀키");
        e.status = 500;
        throw e;
      }
      if (req.schemaName === "classify_extract") {
        return { data: { institution: file.institution, itemType: file.itemType, extracted: [] }, usage: { inputTokens: 10, outputTokens: 5 } };
      }
      const QUOTE = { "R10-1": "임원 보수 현황", "R10-5": "임원 보수 현황" };
      return {
        data: { findings: file.errors.filter((e) => QUOTE[e.ruleId]).map((e) => ({ ruleId: e.ruleId, message: "없는 것으로 보입니다.", confidence: "높음", quote: QUOTE[e.ruleId], location: "1쪽" })) },
        usage: { inputTokens: 10, outputTokens: 5 },
      };
    },
  };
}

if (!argv.includes("--http")) {
  const f = sample("가온에너지공단_임원연봉.pdf");
  const pdf = bytesOf(join(SAMPLES, f.file));
  const run = async (req, ai = fakeAi(f)) => {
    const res = await handleCheck(req, () => ai);
    return { res, body: await res.json(), ai };
  };

  console.log("== 1. 정상 요청");
  {
    const { res, body, ai } = await run(post(formOf({ name: f.file, bytes: pdf, model: "gpt-6-luna" })));
    check(res.status === 200 && body.status === "ok", "파일 1개 → 200, 점검 결과(FileResult)", `status=${body.status}`);
    check(body.findings.map((x) => x.ruleId).sort().join() === "R10-1,R10-5", "지적이 정답과 같음", body.findings.map((x) => x.ruleId).join(", "));
    check(body.model === "gpt-6-luna" && ai.calls.every((m) => m === "gpt-6-luna"), "고른 모델로 점검하고 결과에 모델 이름이 남음", body.model);
    check(typeof body.elapsedMs === "number" && body.usage?.inputTokens === 20, "처리 시간과 토큰 사용량이 기록됨", `${body.elapsedMs}ms`);
    check(body.fileName === f.file, "결과에 파일 이름이 들어감");
  }
  {
    const { body } = await run(post(formOf({ name: f.file, bytes: pdf })));
    check(body.model === "gpt-6.1-sol", "모델을 안 보내면 기본 모델(gpt-6.1-sol)");
  }
  {
    const x = new ExcelJS.Workbook();
    x.addWorksheet("임원연봉").getCell("B1").value = "기본급(기본연봉) 측정용 문구입니다";
    const xlsx = new Uint8Array(await x.xlsx.writeBuffer());
    const { res, body } = await run(post(formOf({ name: "표.xlsx", bytes: xlsx })));
    check(res.status === 200 && body.status === "ok", "엑셀(.xlsx)도 받아서 점검", `status=${body.status}`);
  }

  console.log("\n== 2. 요청 자체가 잘못된 경우 (AI는 부르지 않음)");
  {
    const bad = await run(post(formOf({ name: f.file, bytes: pdf, model: "gpt-4" })));
    check(bad.res.status === 400 && bad.body.error === "허용되지 않은 AI 모델" && bad.ai.calls.length === 0, "허용되지 않은 모델 → 400, AI 호출 0번", bad.body.error);

    const inject = await run(post(formOf({ name: f.file, bytes: pdf, model: "gpt-6-luna; 다른것" })));
    check(inject.res.status === 400 && inject.ai.calls.length === 0, "이상한 모델 이름도 거절");

    const none = await run(post(formOf({ name: f.file, bytes: pdf, noFile: true })));
    check(none.res.status === 400 && none.body.error === "점검할 파일이 없음", "파일이 없으면 400");

    const empty = await run(post(formOf({ name: "빈.pdf", bytes: new Uint8Array() })));
    check(empty.res.status === 400 && empty.body.error === "빈 파일", "빈 파일 → 400");

    const big = await run(post(formOf({ name: "큰.pdf", bytes: new Uint8Array(MAX_FILE_BYTES + 1) })));
    check(big.res.status === 413 && big.ai.calls.length === 0, "4MB를 넘는 파일 → 413", big.body.error);

    const exact = await run(post(formOf({ name: "딱4MB.pdf", bytes: new Uint8Array(MAX_FILE_BYTES) })));
    check(exact.res.status === 200, "정확히 4MB는 받음 (읽을 수 없는 파일이라 status만 다름)", `status=${exact.body.status}`);

    const early = await run(post(formOf({ name: f.file, bytes: pdf }), { "content-length": String(MAX_FILE_BYTES + 1_000_000) }));
    check(early.res.status === 413, "요청 크기를 미리 알리면 본문을 읽기 전에 413");

    const hwp = await run(post(formOf({ name: "문서.hwp", bytes: new Uint8Array([1, 2, 3]) })));
    check(hwp.res.status === 415 && hwp.ai.calls.length === 0, ".hwp 같은 형식 → 415", hwp.body.error);

    const json = await run(new Request("http://localhost/api/check", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
    check(json.res.status === 415, "multipart가 아닌 요청 → 415");
  }

  console.log("\n== 3. 파일 하나의 문제는 그 파일의 결과로만 알림 (200)");
  {
    const scanAi = fakeAi(f);
    const scan = await run(post(formOf({ name: "스캔본.pdf", bytes: bytesOf(join(SAMPLES, "exceptions", "스캔본_임원연봉.pdf")) })), scanAi);
    check(scan.res.status === 200 && scan.body.status === "unreadable" && scanAi.calls.length === 0, "스캔본 → 200, 글자를 읽을 수 없음, AI 호출 0번", scan.body.reason);

    const aiFail = await run(post(formOf({ name: f.file, bytes: pdf })), fakeAi(f, { fail: true }));
    check(aiFail.res.status === 200 && aiFail.body.status === "failed" && aiFail.body.reason === "AI 호출 실패 (500)", "AI 호출 실패 → 200, 그 파일만 '점검 실패'", aiFail.body.reason);
    check(!JSON.stringify(aiFail.body).includes("sk-"), "내부 오류 문구가 응답으로 새지 않음");

    const broken = await run(post(formOf({ name: "깨진.pdf", bytes: new Uint8Array(Buffer.from("PDF 아님")) })));
    check(broken.res.status === 200 && broken.body.status === "failed", "손상된 파일 → 200, 점검 실패");
  }

  console.log("\n== 4. 서버 설정 문제");
  {
    const res = await handleCheck(post(formOf({ name: f.file, bytes: pdf })), () => { throw new Error("OPENAI_API_KEY가 없음"); });
    const body = await res.json();
    check(res.status === 500 && body.error === "서버 설정 문제로 점검할 수 없음", "AI 키가 없으면 500", body.error);
    check(!JSON.stringify(body).includes("OPENAI_API_KEY"), "설정 이름이 응답으로 새지 않음");
    const badModelFirst = await handleCheck(post(formOf({ name: f.file, bytes: pdf, model: "gpt-4" })), () => { throw new Error("키 없음"); });
    check(badModelFirst.status === 400, "키가 없어도 요청 검사는 먼저 끝남 (모델 오류는 400)");
  }

  console.log("\n== 5. route.ts 설정");
  {
    const src = readFileSync(join(ROOT, "app", "api", "check", "route.ts"), "utf-8");
    check(src.includes(`export const maxDuration = ${CHECK_MAX_DURATION_SECONDS};`), `maxDuration이 lib/limits.ts와 같은 ${CHECK_MAX_DURATION_SECONDS}초`);
    check(/export async function POST\(/.test(src) && !/export (async )?function (GET|PUT|DELETE|PATCH)/.test(src), "POST만 열려 있음");
  }

  console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
  process.exit(failures === 0 ? 0 : 1);
}

// --- 켜 둔 개발 서버에 실제 요청 (--http) ---------------------------------------
const base = argv[argv.indexOf("--http") + 1]?.startsWith("http") ? argv[argv.indexOf("--http") + 1] : "http://localhost:3000";
const url = `${base}/api/check`;
const send = async (fd) => {
  const res = await fetch(url, { method: "POST", body: fd });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const name = "가온에너지공단_직원평균보수.pdf";
const pdf = bytesOf(join(SAMPLES, name));
console.log(`== 실제 서버 시험: ${url}\n`);

const a = await send(formOf({ name, bytes: pdf, model: "gpt-4" }));
check(a.status === 400 && a.body.error === "허용되지 않은 AI 모델", "허용되지 않은 모델 → 400", JSON.stringify(a.body));
const b = await send(formOf({ name: "문서.hwp", bytes: new Uint8Array([1, 2, 3]) }));
check(b.status === 415, ".hwp → 415", JSON.stringify(b.body));
const c = await send(formOf({ name: "큰.pdf", bytes: new Uint8Array(MAX_FILE_BYTES + 1) }));
check(c.status === 413, "4MB 초과 → 413", JSON.stringify(c.body));
const d = await send(formOf({ name, bytes: pdf, noFile: true }));
check(d.status === 400, "파일 없음 → 400");
const get = await fetch(url);
check(get.status === 405, "GET은 405 (POST만 열려 있음)", `status=${get.status}`);

console.log("\n● 진짜 AI 한 번 (gpt-6-luna, 파일 1개)");
const t0 = Date.now();
const r = await send(formOf({ name, bytes: pdf, model: "gpt-6-luna" }));
const f = sample(name);
const got = (r.body.findings ?? []).map((x) => x.ruleId).sort();
console.log(`  HTTP ${r.status} · status=${r.body.status} · 모델 ${r.body.model} · 서버 ${r.body.elapsedMs}ms (왕복 ${Date.now() - t0}ms) · 토큰 ${r.body.usage?.inputTokens}/${r.body.usage?.outputTokens}`);
console.log(`  기관 ${r.body.institution} · 항목 ${r.body.itemType} · 지적 [${got.join(", ") || "-"}] / 정답 [${f.errors.map((e) => e.ruleId).join(", ")}]`);
check(r.status === 200 && r.body.status === "ok" && r.body.model === "gpt-6-luna", "실제 요청이 끝까지 처리됨");

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
