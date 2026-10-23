import NoticeBanner from "@/components/NoticeBanner";
import StartScreen from "@/components/StartScreen";

const NAV = [
  { href: "#alio-title", label: "알리오에서 가져오기" },
  { href: "#upload-title", label: "파일 올리기" },
  { href: "#result-title", label: "결과" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pb-32 pt-5 sm:px-6">
      {/* 위쪽 알약 모양 메뉴 */}
      <nav aria-label="바로가기" className="flex items-center justify-between gap-4 rounded-full bg-white/95 px-5 py-3 shadow-[0_10px_30px_rgba(40,80,150,0.12)]">
        <span className="serif flex items-center gap-2 text-xl font-bold tracking-tight text-[var(--ink)]">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />
          공시살핌
        </span>
        <ul className="hidden items-center gap-6 text-sm font-medium text-[var(--muted)] md:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="transition-colors hover:text-[var(--ink)]">
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <span className="rounded-full bg-[var(--ink)] px-4 py-1.5 text-xs font-semibold text-white">경영관리과 전용</span>
      </nav>

      {/* 첫 화면 */}
      <header className="grid items-center gap-8 py-4 md:grid-cols-[1.25fr_1fr] md:py-8">
        <div>
          <p className="mb-4 inline-block rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[var(--brand)]">공공기관 공시살핌</p>
          <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-[var(--ink)] sm:text-5xl">
            공시를 살피고,
            <br />
            <span className="text-[#6b7f9c]">의심 항목부터 짚어요</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--muted)]">
            알리오에 올라온 경영공시 보고서를 통합공시 기준과 AI로 대조해, 오류가 의심되는 항목을 기관별로 보여 줍니다. 최종 판단은 담당자가 합니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#alio-title" className="btn-primary">
              알리오에서 가져와 점검하기
            </a>
            <a href="#upload-title" className="btn-ghost inline-flex items-center px-5 text-sm">
              파일로 올리기
            </a>
          </div>
        </div>

        {/* 숫자 카드 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 rounded-[28px] bg-[#fbbf24] p-5 shadow-[0_14px_30px_rgba(180,120,0,0.25)]">
            <p className="text-sm font-bold text-[#3b2a00]">점검 기준으로 대조하는 항목</p>
            <p className="mt-2 flex items-end gap-3 text-[#2b1d00]">
              <span className="text-5xl font-extrabold leading-none tracking-tight">2</span>
              <span className="pb-1 text-sm font-semibold leading-snug">
                임원 연봉 · 직원 평균보수
                <br />
                (통합공시 기준 별표 1)
              </span>
            </p>
          </div>
          <div className="rounded-[24px] bg-white/95 p-5 shadow-[0_10px_30px_rgba(40,80,150,0.1)]">
            <p className="serif text-4xl font-bold leading-none text-[var(--ink)]">57</p>
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">알리오에서 가져올 수 있는 공시 항목</p>
          </div>
          <div className="rounded-[24px] bg-white/95 p-5 shadow-[0_10px_30px_rgba(40,80,150,0.1)]">
            <p className="serif text-4xl font-bold leading-none text-[var(--ink)]">342</p>
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">고를 수 있는 기관 (본부 기준)</p>
          </div>
        </div>
      </header>

      <NoticeBanner />
      <StartScreen />
    </main>
  );
}
