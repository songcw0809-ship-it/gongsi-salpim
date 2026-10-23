"use client";

// 접속 비밀번호 화면 (lib/auth.ts, proxy.ts). 비밀번호가 맞으면 쿠키가 심어지고 처음 화면으로 돌아간다.
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      const next = new URLSearchParams(window.location.search).get("next") ?? "/";
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, next }),
      });
      const data: { ok?: boolean; next?: string; error?: string } = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        window.location.assign(data.next ?? "/");
        return;
      }
      setError(data.error ?? "들어갈 수 없습니다. 잠시 뒤 다시 해 주세요");
    } catch {
      setError("서버에 연결하지 못했습니다. 잠시 뒤 다시 해 주세요");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
      <div className="flex items-center justify-center gap-2 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--sun)]" />
        공시살핌
      </div>
      <form onSubmit={submit} className="card flex flex-col gap-4">
        <div>
          <h1 className="card-title">접속 비밀번호</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            이 점검 도구는 AI 사용 비용이 들어서 비밀번호를 아는 분만 쓸 수 있습니다.
          </p>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-bold text-[var(--ink)]">
          비밀번호
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field w-full"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
        </label>
        {error && (
          <p id="login-error" role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !password} className="btn-primary justify-center">
          {busy ? "확인 중…" : "들어가기"}
        </button>
      </form>
    </main>
  );
}
