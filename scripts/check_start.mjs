// 시작 화면이 쓰는 순수 로직(lib/precheck.ts, lib/run-pool.ts)이 PRD·DESIGN 규칙대로 동작하는지 확인한다.
//
// 실행:  node scripts/check_start.mjs
// AI 호출·화면 없이 시험한다. 화면 동작은 개발 서버에서 따로 확인한다.

import { MAX_FILE_BYTES } from "../lib/limits.ts";
import { formatSize, precheck } from "../lib/precheck.ts";
import { MAX_CONCURRENT_CHECKS, runPool } from "../lib/run-pool.ts";
import { requestCheck } from "../lib/check-client.ts";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

console.log("== 1. 사전 검사 (서버와 같은 순서·문구)");
{
  check(precheck({ name: "a.pdf", size: 1000 }).ok, "PDF는 통과");
  check(precheck({ name: "A.XLSX", size: 1000 }).ok, "대문자 확장자(.XLSX)도 통과");
  check(precheck({ name: "a.pdf", size: MAX_FILE_BYTES }).ok, "정확히 4MB는 통과");
  const big = precheck({ name: "a.pdf", size: MAX_FILE_BYTES + 1 });
  check(!big.ok && big.reason === "파일이 4MB를 넘어 점검할 수 없음", "4MB 초과는 처리 불가", big.reason);
  const hwp = precheck({ name: "a.hwp", size: 10 });
  check(!hwp.ok && hwp.reason.includes("PDF 또는 엑셀"), ".hwp는 처리 불가", hwp.reason);
  const empty = precheck({ name: "a.pdf", size: 0 });
  check(!empty.ok && empty.reason === "빈 파일", "빈 파일은 처리 불가");
  const both = precheck({ name: "a.hwp", size: MAX_FILE_BYTES + 1 });
  check(!both.ok && both.reason.includes("4MB"), "크기와 형식이 모두 틀리면 서버와 같이 크기를 먼저 알림");
  check(formatSize(500) === "500B" && formatSize(2048) === "2KB" && formatSize(1.5 * 1024 * 1024) === "1.5MB", "크기 표시 문구");
}

console.log("\n== 2. 동시 실행: 최대 3개, 모두 처리, 입력 순서대로 시작");
{
  check(MAX_CONCURRENT_CHECKS === 3, "동시 실행 한도는 3개");
  let active = 0;
  let peak = 0;
  const started = [];
  const done = [];
  const items = Array.from({ length: 10 }, (_, i) => i);
  await runPool(items, MAX_CONCURRENT_CHECKS, async (i) => {
    started.push(i);
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5 + (i % 3) * 3));
    active--;
    done.push(i);
  });
  check(peak === 3, "동시에 3개를 넘지 않고 3개까지 씀", `최대 동시 ${peak}개`);
  check(done.length === 10 && new Set(done).size === 10, "10개 모두 한 번씩 처리됨");
  check(started.join() === items.join(), "시작 순서가 입력 순서와 같음");
  await runPool([], 3, async () => { throw new Error("부르면 안 됨"); });
  check(true, "빈 목록은 아무것도 하지 않음");
  let n = 0;
  await runPool([1, 2], 5, async () => { n++; });
  check(n === 2, "항목이 한도보다 적어도 정상 처리");
}

console.log("\n== 3. 점검 요청 (fetch를 가짜로 바꿔 시험)");
{
  const file = new File([new Uint8Array([1, 2, 3])], "a.pdf");
  const real = globalThis.fetch;
  const sent = [];
  const fake = (response) => async (url, init) => {
    sent.push({ url, method: init?.method, model: init?.body?.get("model"), name: init?.body?.get("file")?.name });
    return response();
  };

  globalThis.fetch = fake(() => Response.json({ fileName: "a.pdf", status: "ok", findings: [] }));
  const ok = await requestCheck(file, "gpt-6-luna");
  check(ok.ok && ok.result.status === "ok", "성공하면 점검 결과를 돌려줌");
  check(sent[0].url === "/api/check" && sent[0].method === "POST" && sent[0].model === "gpt-6-luna" && sent[0].name === "a.pdf", "POST /api/check 로 파일과 고른 모델을 보냄");

  globalThis.fetch = fake(() => Response.json({ error: "허용되지 않은 AI 모델" }, { status: 400 }));
  const bad = await requestCheck(file, "x");
  check(!bad.ok && bad.error === "허용되지 않은 AI 모델", "서버가 거절하면 그 이유를 돌려줌", bad.error);

  globalThis.fetch = fake(() => new Response("<html>", { status: 502 }));
  const html = await requestCheck(file, "x");
  check(!html.ok && html.error === "서버 오류 (502)", "JSON이 아닌 오류 응답은 상태 코드로 알림", html.error);

  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  const down = await requestCheck(file, "x");
  check(!down.ok && down.error === "서버에 연결할 수 없음", "서버에 연결되지 않아도 던지지 않고 이유를 돌려줌", down.error);
  globalThis.fetch = real;
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
