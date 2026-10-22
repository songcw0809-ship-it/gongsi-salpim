import StartScreen from "@/components/StartScreen";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">경영공시 AI 점검기</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          공공기관 경영공시 보고서를 내장한 통합공시 기준과 AI로 대조해, 오류가 의심되는 항목을 기관별로 보여 줍니다.
          최종 판단은 담당자가 합니다.
        </p>
      </header>
      <div
        role="note"
        className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      >
        파일 내용이 외부 AI 서비스로 전송됩니다. 파일과 점검 결과는 저장하지 않으며, 새로고침하면 결과가 사라집니다.
      </div>
      <StartScreen />
    </main>
  );
}
