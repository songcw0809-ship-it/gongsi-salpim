// 접속 비밀번호: 로그인(회원) 기능이 아니라, 주소를 아는 아무나 점검(=AI 비용)을 쓰지 못하게 막는 문 하나다.
// 서버 환경변수 ACCESS_PASSWORD 가 있으면 켜지고, 없으면 꺼진다(내 컴퓨터에서 개발할 때는 비밀번호 없이 쓴다).
//
// 쿠키에는 비밀번호가 아니라 비밀번호에서 만든 확인값(SHA-256)을 넣는다. 확인값만으로는 비밀번호를 알 수 없다.
// 이 파일은 일반 함수만 있어서 화면 없이 시험할 수 있다 (scripts/check_auth.mjs).

export const AUTH_COOKIE = "gs_auth";
/** 한 번 들어오면 이 기간 동안 다시 묻지 않는다 (초) */
export const AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
/** 비밀번호 틀림 횟수 제한 (서버 인스턴스마다 따로 센다) */
export const LOGIN_RATE_LIMIT = { max: 10, windowMs: 5 * 60 * 1000 } as const;

/** 설정된 접속 비밀번호. 없으면 null(문이 꺼진 상태) */
export function accessPassword(env: Record<string, string | undefined> = process.env): string | null {
  const v = env.ACCESS_PASSWORD?.trim();
  return v ? v : null;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 비밀번호에서 만든 쿠키 확인값 */
export function tokenFor(password: string): Promise<string> {
  return sha256Hex(`gongsi-salpim|access|${password}`);
}

/** 두 글자를 같은 시간에 비교한다 (어디서 달라졌는지 시간 차이로 알아내지 못하게) */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 입력한 비밀번호가 맞는가. 길이가 달라도 같은 방식으로 비교하도록 둘 다 해시해서 견준다 */
export async function passwordMatches(input: string, password: string): Promise<boolean> {
  const [a, b] = await Promise.all([tokenFor(input), tokenFor(password)]);
  return sameText(a, b);
}

/** 쿠키 값이 현재 비밀번호의 확인값과 같은가 */
export async function isAuthed(cookieValue: string | undefined, password: string | null): Promise<boolean> {
  if (!password) return true; // 문이 꺼져 있으면 모두 통과
  if (!cookieValue) return false;
  return sameText(cookieValue, await tokenFor(password));
}

/** 비밀번호 없이 열려 있어야 하는 주소: 로그인 화면과 로그인·나가기 API */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/api/auth/login" || pathname === "/api/auth/logout";
}

export type GateDecision = "next" | "login" | "unauthorized";

/** 요청 하나를 통과시킬지 정한다. 화면은 로그인으로 보내고, API 는 401 로 거절한다 */
export async function gateDecision(pathname: string, cookieValue: string | undefined, password: string | null): Promise<GateDecision> {
  if (!password) return "next";
  if (isPublicPath(pathname)) return "next";
  if (await isAuthed(cookieValue, password)) return "next";
  return pathname.startsWith("/api/") ? "unauthorized" : "login";
}

/** 로그인 뒤 돌아갈 곳. 같은 사이트 안의 경로만 허용한다 (밖으로 보내는 주소 조작 방지) */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.startsWith("/login") || value.startsWith("/api/")) return "/";
  return value;
}
