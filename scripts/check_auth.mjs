// 접속 비밀번호 문(lib/auth.ts)을 확인한다.
//
// 실행:  node scripts/check_auth.mjs
import { AUTH_COOKIE, accessPassword, gateDecision, isAuthed, isPublicPath, passwordMatches, safeNext, tokenFor } from "../lib/auth.ts";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

console.log("== 1. 설정");
check(accessPassword({}) === null && accessPassword({ ACCESS_PASSWORD: "  " }) === null, "비밀번호가 없거나 비어 있으면 문이 꺼짐(null)");
check(accessPassword({ ACCESS_PASSWORD: " abc " }) === "abc", "앞뒤 공백은 뺌");

console.log("\n== 2. 확인값·비교");
{
  const t = await tokenFor("pw1");
  check(/^[0-9a-f]{64}$/.test(t) && t === (await tokenFor("pw1")), "확인값은 64자리 16진수이고 같은 비밀번호면 늘 같음");
  check(t !== (await tokenFor("pw2")) && !t.includes("pw1"), "비밀번호가 다르면 확인값도 다르고, 확인값에 비밀번호가 들어 있지 않음");
  check((await passwordMatches("pw1", "pw1")) && !(await passwordMatches("pw1x", "pw1")) && !(await passwordMatches("", "pw1")), "맞는 비밀번호만 통과, 길이가 달라도 틀리면 거절");
  check(await isAuthed(t, "pw1"), "맞는 쿠키는 통과");
  check(!(await isAuthed("가짜", "pw1")) && !(await isAuthed(undefined, "pw1")) && !(await isAuthed(await tokenFor("옛비밀번호"), "pw1")), "가짜·없는·옛 비밀번호의 쿠키는 거절 (비밀번호를 바꾸면 이전 로그인은 무효)");
  check(await isAuthed(undefined, null), "문이 꺼져 있으면 쿠키 없이도 통과");
}

console.log("\n== 3. 어떤 요청을 막는가");
{
  const t = await tokenFor("pw1");
  check((await gateDecision("/", undefined, "pw1")) === "login", "쿠키 없는 화면 요청은 로그인으로 보냄");
  check((await gateDecision("/api/check", undefined, "pw1")) === "unauthorized" && (await gateDecision("/api/alio/check", undefined, "pw1")) === "unauthorized" && (await gateDecision("/api/alio/institutions", undefined, "pw1")) === "unauthorized", "쿠키 없는 API 요청은 401 (AI 비용이 드는 주소 포함)");
  check((await gateDecision("/login", undefined, "pw1")) === "next" && (await gateDecision("/api/auth/login", undefined, "pw1")) === "next", "로그인 화면과 로그인 API는 비밀번호 없이 열림");
  check((await gateDecision("/", t, "pw1")) === "next" && (await gateDecision("/api/check", t, "pw1")) === "next", "맞는 쿠키가 있으면 모두 통과");
  check((await gateDecision("/api/check", undefined, null)) === "next", "문이 꺼져 있으면 모두 통과");
  check(!isPublicPath("/login/../api/check") && !isPublicPath("/api/auth/login/x") && !isPublicPath("/api/check"), "열려 있는 주소는 정확히 3개뿐, 비슷한 주소는 열리지 않음");
  check(AUTH_COOKIE === "gs_auth", "쿠키 이름");
}

console.log("\n== 4. 로그인 뒤 돌아갈 곳");
check(safeNext("/") === "/" && safeNext(null) === "/" && safeNext("") === "/", "기본은 처음 화면");
check(safeNext("//evil.example.com") === "/" && safeNext("https://evil.example.com") === "/" && safeNext("/\\evil.example.com") === "/", "다른 사이트로 보내는 주소는 처음 화면으로 바꿈");
check(safeNext("/login") === "/" && safeNext("/api/check") === "/", "로그인·API 주소로는 돌려보내지 않음");

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
