// POST /api/auth/logout: 접속 쿠키를 지운다.
import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/origin";
import { AUTH_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "허용되지 않은 요청 출처" }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
