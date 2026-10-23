// 실제 알리오 보고서로 새 점검 기준을 확인한다 (진짜 알리오·AI를 부르므로 비용이 든다).
//
// 실행:  node scripts/check_items_live.mjs                 # 기관 1곳 × 새 항목 7개
//        node scripts/check_items_live.mjs --name 한국공항공사   # 다른 기관
//
// 1) 원본 보고서를 그대로 점검한다 → 지적이 나오면 오탐 후보 (사람이 확인)
// 2) 같은 보고서에서 특정 줄을 지운 글로 점검한다 → 지운 항목을 찾아내는지 (탐지 시험)
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createAlioClient } from "../lib/alio/client.ts";
import { FETCHABLE_ITEMS } from "../lib/alio/items.ts";
import { extractPdf } from "../lib/extract/pdf.ts";
import { analyzeKnownDocument } from "../lib/ai/analyze.ts";
import { rulesFor } from "../lib/checklist.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(join(ROOT, ".env"), "utf-8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch {}
const { createOpenAiClientFromEnv } = await import("../lib/ai/openai.ts");
const argv = process.argv.slice(2);
const instName = argv.includes("--name") ? argv[argv.indexOf("--name") + 1] : "인천국제공항공사";
const ai = createOpenAiClientFromEnv();
const alio = createAlioClient();
const found = (await alio.listInstitutions()).find((i) => i.name === instName);
if (!found) throw new Error("기관을 찾을 수 없음: " + instName);
const inst = found.id;
console.log(`기관: ${found.name} (${inst})`);
const model = "gpt-6.1-sol";
const NEW = ["임직원수", "신규채용", "기관장업무추진비", "복리후생비", "일가정양립", "장애인고용", "수입지출"];

const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;
for (const item of FETCHABLE_ITEMS.filter((i) => NEW.includes(i.checklist) && (!only || i.checklist === only))) {
  console.log(`\n===== ${item.no} ${item.name} (${item.checklist}) · 기관 ${inst}`);
  const d = await alio.findDisclosure(inst, item.formNo);
  if (!d) {
    console.log("  이 기관에는 이 보고서가 없음");
    continue;
  }
  const bytes = await alio.downloadReport(d.disclosureNo);
  const t = await extractPdf(bytes);
  if (t.status !== "ok") {
    console.log("  글자를 읽을 수 없음", t.reason);
    continue;
  }
  const rules = rulesFor(item.checklist).map((r) => r.id);
  console.log(`  글자 수 ${t.units.reduce((n, u) => n + u.text.length, 0)}`);
  let a;
  const t0 = Date.now();
  try {
    a = await analyzeKnownDocument({ units: t.units, model, ai, itemName: item.name, checklist: item.checklist });
  } catch (e) {
    console.log(`  ✗ 점검 실패 (${Math.round((Date.now() - t0) / 1000)}초): ${e?.constructor?.name} ${String(e?.message ?? e).slice(0, 80)}`);
    continue;
  }
  console.log(`  처리 ${Math.round((Date.now() - t0) / 1000)}초`);
  console.log(`  ${d.period ?? ""} · 기준 ${rules.length}개 · 쪽 ${t.units.length}개 · 원본 지적 ${a.findings.length}건`);
  for (const f of a.findings) console.log(`    [원본] ${f.ruleId} (${f.confidence}) ${f.message}`);
  if (a.dropped?.length) console.log(`    (검증 장치가 버린 지적 ${a.dropped.length}건)`);
  console.log(`  토큰 ${a.usage.inputTokens}/${a.usage.outputTokens}`);
}
