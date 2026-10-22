// Design Ref: DESIGN.md §3.2 — AI 호출은 서버에서만 한다. OPENAI_API_KEY는 브라우저에 보내지 않는다.
import OpenAI from "openai";
import type { AiClient } from "./analyze.ts";

export function createOpenAiClient(apiKey: string): AiClient {
  const client = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 1 });
  return {
    async json({ model, system, user, schemaName, schema }) {
      const res = await client.responses.create({
        model,
        instructions: system,
        input: user,
        // 정해진 JSON 모양으로만 답하게 한다 (Structured Outputs).
        text: { format: { type: "json_schema", name: schemaName, schema, strict: true } },
      });
      return {
        data: JSON.parse(res.output_text),
        usage: {
          inputTokens: res.usage?.input_tokens ?? 0,
          outputTokens: res.usage?.output_tokens ?? 0,
        },
      };
    },
  };
}

/** 서버 환경변수의 OPENAI_API_KEY로 만든다. 없으면 오류. */
export function createOpenAiClientFromEnv(): AiClient {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("서버에 OPENAI_API_KEY가 설정되어 있지 않음");
  return createOpenAiClient(key);
}
