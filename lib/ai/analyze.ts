// Design Ref: DESIGN.md §2.2 ③④⑤ — AI로 분류·추출하고, 체크리스트와 대조한 뒤, 검증 장치를 거친다.
// Plan SC: PLAN.md 5번 — 파일 1개에서 기관명·항목 종류·항목과 값을 뽑고 체크리스트와 대조해 지적 목록을 돌려주기.
//
// AI 호출은 AiClient 뒤에 숨겨 두어, 실제 AI 없이도 같은 흐름을 시험할 수 있다.
import { z } from "zod";
import { rulesFor } from "../checklist.ts";
import type { ItemType } from "../checklist.ts";
import { normalizeInstitution, normalizeItemType } from "../aggregate.ts";
import { verifyFindings } from "../guard.ts";
import type {
  DroppedFinding,
  ExtractedField,
  Finding,
  RawFinding,
  TextUnit,
} from "../types.ts";
import {
  CHECK_SCHEMA,
  CHECK_SCHEMA_NAME,
  CLASSIFY_SCHEMA_NAME,
  EXTRACT_SCHEMA,
  EXTRACT_SCHEMA_NAME,
  MAX_DOC_CHARS,
  checkPrompt,
  classifyPrompt,
  classifySchema,
  extractPrompt,
  renderDocument,
} from "./prompts.ts";

export interface AiRequest {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
}

export interface AiResponse {
  data: unknown;
  usage?: { inputTokens: number; outputTokens: number };
}

/** AI를 부르는 방법. 실제 구현은 lib/ai/openai.ts, 시험에서는 가짜를 끼운다. */
export interface AiClient {
  json(req: AiRequest): Promise<AiResponse>;
}

export interface Analysis {
  institution: string | null;
  itemType: ItemType | null;
  extracted: ExtractedField[];
  findings: Finding[];
  dropped: DroppedFinding[];
  usage: { inputTokens: number; outputTokens: number };
}

const NOT_EXTRACTED = "추출 불가";

const classifyAnswer = z.object({
  institution: z.string().nullable(),
  itemType: z.string().nullable(),
  extracted: z.array(z.object({ label: z.string(), value: z.string(), location: z.string() })),
});

const extractAnswer = z.object({
  extracted: z.array(z.object({ label: z.string(), value: z.string(), location: z.string() })),
});

const checkAnswer = z.object({
  findings: z.array(
    z.object({
      ruleId: z.string(),
      message: z.string(),
      confidence: z.string(),
      quote: z.string(),
      location: z.string(),
    }),
  ),
});

const flat = (s: string) => s.normalize("NFC").replace(/[\s,]/g, "");

/**
 * AI가 뽑은 값이 실제 문서에 있는지 확인한다. 없으면 지어낸 것으로 보고 "추출 불가"로 바꾼다.
 * 위치도 AI 말을 믿지 않고 값이 실제로 있는 곳으로 바꾼다 (PRD 5번 M1: 파일에 없는 값을 지어내지 않는다).
 */
function checkExtracted(
  fields: readonly { label: string; value: string; location: string }[],
  units: readonly TextUnit[],
): ExtractedField[] {
  const flatUnits = units.map((u) => ({ location: u.location, text: flat(u.text) }));
  return fields.map((f) => {
    const value = f.value.trim();
    if (!value || value === NOT_EXTRACTED) {
      return { label: f.label, value: NOT_EXTRACTED, location: f.location };
    }
    const hit = flatUnits.find((u) => u.text.includes(flat(value)));
    return hit
      ? { label: f.label, value, location: hit.location }
      : { label: f.label, value: NOT_EXTRACTED, location: f.location };
  });
}

export async function analyzeDocument(args: {
  units: readonly TextUnit[];
  model: string;
  ai: AiClient;
  /** 이 앱이 아는 항목 종류. 체크리스트에서 가져온다 */
  itemTypes: readonly ItemType[];
}): Promise<Analysis> {
  const { units, model, ai, itemTypes } = args;
  const usage = { inputTokens: 0, outputTokens: 0 };
  const addUsage = (u?: { inputTokens: number; outputTokens: number }) => {
    usage.inputTokens += u?.inputTokens ?? 0;
    usage.outputTokens += u?.outputTokens ?? 0;
  };

  if (renderDocument(units).length > MAX_DOC_CHARS) {
    throw new Error("문서가 너무 길어 점검할 수 없음");
  }

  // ③ 분류·추출
  const c = classifyPrompt(units, itemTypes);
  const classified = await ai.json({
    model,
    system: c.system,
    user: c.user,
    schemaName: CLASSIFY_SCHEMA_NAME,
    schema: classifySchema(itemTypes),
  });
  addUsage(classified.usage);
  const a = classifyAnswer.parse(classified.data);

  const institution = normalizeInstitution(a.institution);
  const itemType = normalizeItemType(a.itemType, itemTypes);
  const extracted = checkExtracted(a.extracted, units);

  // 항목 종류를 모르면 어느 체크리스트로 대조할지 정할 수 없다. 짐작하지 않고 대조하지 않는다.
  if (!itemType) {
    return { institution, itemType, extracted, findings: [], dropped: [], usage };
  }

  // ④ 체크리스트 대조 · ⑤ 검증
  const { findings, dropped } = await runCheck({ units, itemType, model, ai, addUsage });
  return { institution, itemType, extracted, findings, dropped, usage };
}

/** ④ 체크리스트 대조와 ⑤ 검증 장치. 항목 종류를 알 때만 부른다. */
async function runCheck(args: {
  units: readonly TextUnit[];
  itemType: ItemType;
  model: string;
  ai: AiClient;
  addUsage: (u?: { inputTokens: number; outputTokens: number }) => void;
}): Promise<{ findings: Finding[]; dropped: DroppedFinding[] }> {
  const { units, itemType, model, ai, addUsage } = args;
  const rules = rulesFor(itemType);
  const k = checkPrompt(units, rules);
  const checked = await ai.json({
    model,
    system: k.system,
    user: k.user,
    schemaName: CHECK_SCHEMA_NAME,
    schema: CHECK_SCHEMA,
  });
  addUsage(checked.usage);
  const raw: RawFinding[] = checkAnswer.parse(checked.data).findings.map((f) => ({
    ruleId: f.ruleId,
    message: f.message,
    confidence: f.confidence,
    evidence: { quote: f.quote, location: f.location },
  }));
  return verifyFindings(raw, units, rules);
}

export interface KnownAnalysis {
  extracted: ExtractedField[];
  findings: Finding[];
  dropped: DroppedFinding[];
  /** 내장 점검 기준으로 대조했는가. 기준이 없는 항목은 값만 뽑고 false */
  checked: boolean;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * 기관과 항목 종류를 이미 아는 보고서(알리오에서 가져온 것)를 분석한다.
 * 분류는 AI에게 묻지 않고 값만 뽑는다. 점검 기준(checklist)이 있는 항목만 체크리스트와 대조하고,
 * 기준이 없는 항목은 대조하지 않는다 — 내장 체크리스트에 없는 규정은 만들어 쓰지 않는다(PRD 5번 M2).
 */
export async function analyzeKnownDocument(args: {
  units: readonly TextUnit[];
  model: string;
  ai: AiClient;
  /** 알리오 항목 이름. 예: "임원 연봉" */
  itemName: string;
  /** 내장 점검 기준이 있는 항목이면 그 항목 종류 */
  checklist?: ItemType;
}): Promise<KnownAnalysis> {
  const { units, model, ai, itemName, checklist } = args;
  const usage = { inputTokens: 0, outputTokens: 0 };
  const addUsage = (u?: { inputTokens: number; outputTokens: number }) => {
    usage.inputTokens += u?.inputTokens ?? 0;
    usage.outputTokens += u?.outputTokens ?? 0;
  };

  if (renderDocument(units).length > MAX_DOC_CHARS) {
    throw new Error("문서가 너무 길어 점검할 수 없음");
  }

  // 값 추출과 체크리스트 대조는 서로 결과를 쓰지 않으므로 동시에 부른다 (긴 보고서에서 처리 시간을 절반 가까이 줄인다)
  const e = extractPrompt(units, itemName);
  const [answer, checked] = await Promise.all([
    ai.json({ model, system: e.system, user: e.user, schemaName: EXTRACT_SCHEMA_NAME, schema: EXTRACT_SCHEMA }),
    checklist ? runCheck({ units, itemType: checklist, model, ai, addUsage }) : Promise.resolve(null),
  ]);
  addUsage(answer.usage);
  const extracted = checkExtracted(extractAnswer.parse(answer.data).extracted, units);

  if (!checked) return { extracted, findings: [], dropped: [], checked: false, usage };
  return { extracted, findings: checked.findings, dropped: checked.dropped, checked: true, usage };
}
