// 접속 비밀번호 문 (lib/auth.ts). ACCESS_PASSWORD 가 설정되어 있으면 모든 화면과 API 를 막고, 맞는 쿠키가 있어야 통과시킨다.
// Next.js 16 에서는 middleware 대신 proxy 라는 이름을 쓴다.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, accessPassword, gateDecision } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const decision = await gateDecision(pathname, request.cookies.get(AUTH_COOKIE)?.value, accessPassword());
  if (decision === "next") return NextResponse.next();
  if (decision === "unauthorized") {
    return NextResponse.json({ error: "접속 비밀번호가 필요합니다" }, { status: 401 });
  }
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // 정적 파일(글꼴·스타일·아이콘)은 비밀번호 없이 보낸다
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
