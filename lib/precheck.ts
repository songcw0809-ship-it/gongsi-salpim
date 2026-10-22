// Design Ref: DESIGN.md §2.2 ① — 점검 시작 전 사전 검사(형식·크기). 브라우저에서 먼저 걸러 서버에 보내지 않는다.
// Plan SC: PLAN.md 10번 — 조건에 맞지 않는 파일은 그 파일만 "처리 불가"로 표시하고 나머지는 계속한다.
//
// 서버(lib/api/check-handler.ts)도 같은 검사를 한 번 더 한다. 순서와 문구를 서버와 맞춰 두었다.
import { MAX_FILE_BYTES, MAX_FILE_LABEL } from "./limits.ts";

export const ACCEPTED_EXTENSIONS = [".pdf", ".xlsx"] as const;

export type Precheck = { ok: true } | { ok: false; reason: string };

export function precheck(file: { name: string; size: number }): Precheck {
  if (file.size === 0) return { ok: false, reason: "빈 파일" };
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, reason: `파일이 ${MAX_FILE_LABEL}를 넘어 점검할 수 없음` };
  }
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return { ok: false, reason: "PDF 또는 엑셀(.xlsx) 파일만 점검할 수 있음" };
  }
  return { ok: true };
}

/** 1234567 → "1.2MB" */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
