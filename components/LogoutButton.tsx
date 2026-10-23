"use client";

import { useRouter } from "next/navigation";

// 접속 쿠키를 지우고 비밀번호 화면으로 돌아간다. 접속 비밀번호가 켜져 있을 때만 화면에 나온다 (app/page.tsx).
export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }
  return (
    <button type="button" onClick={logout} className="btn-ghost">
      나가기
    </button>
  );
}
