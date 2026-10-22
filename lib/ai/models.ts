// Design Ref: DESIGN.md §3.2 — 허용 모델 목록은 이 파일 한 곳에 둔다.
// Plan SC: PLAN.md 5번 — 모델은 허용 목록에서만 받는다 (PRD 7번: 임의 모델로 비용이 늘어나는 것을 막는다).

export interface ModelOption {
  id: string;
  /** 업로드 화면에 보일 한 줄 설명 */
  note: string;
}

export const MODELS: readonly ModelOption[] = [
  { id: "gpt-6.1-sol", note: "기본 · 균형" },
  { id: "gpt-6-luna", note: "저렴 · 빠름" },
  { id: "gpt-6-astra", note: "가장 정확 · 비쌈" },
];

export const FALLBACK_MODEL = "gpt-6.1-sol";

export function isAllowedModel(id: unknown): id is string {
  return typeof id === "string" && MODELS.some((m) => m.id === id);
}

/** 기본 모델. 서버에 OPENAI_MODEL이 있고 허용 목록에 있으면 그것을, 아니면 FALLBACK_MODEL을 쓴다. */
export function defaultModel(env: Record<string, string | undefined> = process.env): string {
  const fromEnv = env.OPENAI_MODEL?.trim();
  return isAllowedModel(fromEnv) ? fromEnv : FALLBACK_MODEL;
}

/**
 * 요청에 들어온 모델 이름을 확인한다.
 * 비어 있으면 기본 모델, 허용 목록에 있으면 그대로, 그 밖의 이름이면 null(거절)을 돌려준다.
 */
export function resolveModel(
  requested: unknown,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (requested === undefined || requested === null || requested === "") return defaultModel(env);
  return isAllowedModel(requested) ? requested : null;
}
