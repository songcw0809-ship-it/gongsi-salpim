// 샘플 12개로 목표 지표를 잰다 (PLAN 15번). 진짜 AI를 부르므로 비용이 든다.
//
// 실행:  node scripts/measure_metrics.mjs                       # 허용 모델 3개 모두
//        node scripts/measure_metrics.mjs --model gpt-6-luna    # 한 모델만
//
// 결과: docs/metrics/raw-<모델>.json (파일별 원본 결과), 화면에는 모델별 지표 표를 출력한다.
// 오탐은 "정답지에 없는 기준에 대한 지적"을 후보로 세므로, 후보의 설명은 사람이 읽고 확인해야 한다.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkFile } from "../lib/check-file.ts";
import { MODELS } from "../lib/ai/models.ts";
import { runPool } from "../lib/run-pool.ts";
import { buildSummary } from "../lib/summary-view.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = join(ROOT, "samples");
const OUT = join(ROOT, "docs", "metrics");
const key = JSON.parse(readFileSync(join(SAMPLES, "answer-key.json"), "utf-8"));
const argv = process.argv.slice(2);

try {
  for (const line of readFileSync(join(ROOT, ".env"), "utf-8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch {}
const { createOpenAiClientFromEnv } = await import("../lib/ai/openai.ts");
const ai = createOpenAiClientFromEnv();

const models = argv.includes("--model") ? [argv[argv.indexOf("--model") + 1]] : MODELS.map((m) => m.id);
mkdirSync(OUT, { recursive: true });

const pct = (a, b) => (b === 0 ? "-" : `${Math.round((a / b) * 1000) / 10}%`);

for (const model of models) {
  console.log(`\n===== ${model} =====`);
  const started = Date.now();
  const results = new Array(key.files.length);
  await runPool(key.files.map((f, i) => ({ f, i })), 3, async ({ f, i }) => {
    results[i] = await checkFile({ fileName: f.file, bytes: new Uint8Array(readFileSync(join(SAMPLES, f.file))), model, ai });
  });
  const wall = Date.now() - started;
  const rows = key.files.map((f, i) => ({ f, r: results[i] }));
  writeFileSync(join(OUT, `raw-${model}.json`), JSON.stringify(rows.map(({ f, r }) => ({ file: f.file, result: r })), null, 2));

  let planted = 0, found = 0, claims = 0, falseCand = 0, withEvidence = 0, failed = 0, inTok = 0, outTok = 0, classifyOk = 0;
  const detail = [];
  for (const { f, r } of rows) {
    if (r.status !== "ok") { failed++; planted += f.errors.length; detail.push(`  ✗ ${f.file}: ${r.status} ${r.reason ?? ""}`); continue; }
    inTok += r.usage?.inputTokens ?? 0; outTok += r.usage?.outputTokens ?? 0;
    if (r.institution === f.institution && r.itemType === f.itemType) classifyOk++;
    const want = new Set(f.errors.map((e) => e.ruleId));
    const got = r.findings.map((x) => x.ruleId);
    planted += want.size;
    found += [...want].filter((id) => got.includes(id)).length;
    claims += got.length;
    const extra = r.findings.filter((x) => !want.has(x.ruleId));
    falseCand += extra.length;
    withEvidence += r.findings.filter((x) => x.ruleId && x.evidence?.quote && x.evidence?.location).length;
    const missed = [...want].filter((id) => !got.includes(id));
    detail.push(`  ${f.file}: 정답 [${[...want].join(",") || "-"}] 지적 [${got.join(",") || "-"}] ${missed.length ? "놓침 " + missed.join(",") : ""} ${extra.length ? "오탐후보 " + extra.map((x) => x.ruleId).join(",") : ""} (${r.elapsedMs}ms)`);
  }
  console.log(detail.join("\n"));

  const summary = buildSummary(rows.map(({ r }, i) => ({ id: i + 1, fileName: rows[i].f.file, phase: "done", result: r })));
  const ranked = summary.institutions.map((s) => `${s.rank ?? "-"}.${s.institution}(높음${s.highCount}/전체${s.findingCount})`);
  const top3 = summary.institutions.filter((s) => s.rank !== null).slice(0, 3).map((s) => s.institution);
  const top3Hit = top3.filter((n) => key.expectedTop3.includes(n)).length;
  const times = rows.map(({ r }) => r.elapsedMs).filter(Boolean);
  const avg = times.reduce((a, b) => a + b, 0) / (times.length || 1);

  console.log(`\n순위: ${ranked.join(" > ")}`);
  console.log(`탐지율 ${found}/${planted} = ${pct(found, planted)} (목표 90%+)`);
  console.log(`오탐 후보 ${falseCand}/${claims} = ${pct(falseCand, claims)} (목표 20%- · 설명 확인 필요)`);
  console.log(`근거 표시율 ${withEvidence}/${claims} = ${pct(withEvidence, claims)} (목표 100%)`);
  console.log(`우선순위: 상위 3곳 중 정답 ${top3Hit}곳 (목표 2곳+)`);
  console.log(`기관·항목 분류 정확 ${classifyOk}/12 · 점검 실패 ${failed}개`);
  console.log(`처리 시간: 파일당 평균 ${Math.round(avg / 100) / 10}초 · 12개 전체 ${Math.round(wall / 100) / 10}초 (동시 3개)`);
  console.log(`토큰: 입력 ${inTok} · 출력 ${outTok}`);
}
