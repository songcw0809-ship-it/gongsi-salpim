import NoticeBanner from "@/components/NoticeBanner";
import StartScreen from "@/components/StartScreen";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">공공기관 공시살핌</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          공공기관 경영공시 보고서를 내장한 통합공시 기준과 AI로 대조해, 오류가 의심되는 항목을 기관별로 보여 줍니다.
          최종 판단은 담당자가 합니다.
        </p>
      </header>
      <NoticeBanner />
      <StartScreen />
    </main>
  );
}
