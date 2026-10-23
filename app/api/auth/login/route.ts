// POST /api/auth/login: 접속 비밀번호를 확인하고 맞으면 쿠키를 심는다.
import { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/api/rate-limit";
import { isSameOrigin } from "@/lib/api/origin";
import { AUTH_COOKIE, AUTH_MAX_AGE_SECONDS, LOGIN_RATE_LIMIT, accessPassword, passwordMatches, safeNext, tokenFor } from "@/lib/auth";

const limiter = createRateLimiter(LOGIN_RATE_LIMIT.max, LOGIN_RATE_LIMIT.windowMs);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "허용되지 않은 요청 출처" }, { status: 403 });

  const password = accessPassword();
  // 문이 꺼져 있으면 비밀번호가 필요 없다
  if (!password) return NextResponse.json({ ok: true, next: "/" });

  const turn = limiter.take();
  if (!turn.ok) {
    return NextResponse.json(
      { error: "시도가 너무 많습니다. 잠시 뒤 다시 해 주세요" },
      { status: 429, headers: { "retry-after": String(turn.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const input = body && typeof body === "object" ? (body as Record<string, unknown>).password : undefined;
  const next = body && typeof body === "object" ? safeNext(String((body as Record<string, unknown>).next ?? "")) : "/";
  if (typeof input !== "string" || input.length === 0 || input.length > 200 || !(await passwordMatches(input, password))) {
    return NextResponse.json({ error: "비밀번호가 맞지 않습니다" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, next });
  res.cookies.set(AUTH_COOKIE, await tokenFor(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE_SECONDS,
  });
  return res;
}
