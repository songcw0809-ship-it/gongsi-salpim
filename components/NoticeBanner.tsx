// Design Ref: DESIGN.md §1.1 — 안내 띠: 외부 AI 전송 고지, 저장하지 않음·새로고침하면 사라짐, 개인정보 안내 (항상 표시).
// Plan SC: PLAN.md 14번 — 알리오에서 가져온 자료도 포함해 외부 AI 전송 고지, 새로고침하면 결과가 사라진다는 안내, 개인정보 안내 (PRD 7번). 공개 자료인 알리오 보고서는 가리지 않는다.

const NOTES = [
  {
    title: "외부 AI로 전송됩니다.",
    body: "올린 파일과 알리오에서 가져온 보고서의 내용이 점검을 위해 외부 AI 서비스로 전송됩니다.",
  },
  {
    title: "저장하지 않습니다.",
    body: "파일, 가져온 보고서, 점검 결과는 서버에 저장하지 않고 이 화면 안에만 있습니다. 새로고침하거나 창을 닫으면 모두 사라지니, 필요한 내용은 그 전에 직접 옮겨 적어 두세요.",
  },
  {
    title: "개인정보 안내.",
    body: "알리오에서 가져온 보고서는 이미 공개된 자료라서 원문 그대로 보여 줍니다. 직접 올린 파일은 담당자 이름이나 연락처가 섞여 있을 수 있어, 전화번호·이메일·주민등록번호로 보이는 값을 화면에서 가려 보여 줍니다. 번호의 형태만 보고 가리므로 놓치는 값이 있을 수 있고, AI로 전송되는 원본에는 그대로 들어 있습니다.",
  },
];

export default function NoticeBanner() {
  return (
    <div role="note" aria-label="이용 안내" className="grid items-start gap-3 md:grid-cols-3">
      {NOTES.map((n, i) => (
        <p key={n.title} className="rounded-[22px] bg-white/80 p-4 text-[13px] leading-relaxed text-[var(--muted)] shadow-[0_6px_20px_rgba(40,80,150,0.07)]">
          <span className="mb-1.5 flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
            <span className={`inline-block h-2 w-2 rounded-full ${i === 0 ? "bg-[var(--sun)]" : i === 1 ? "bg-[var(--leaf)]" : "bg-[var(--brand)]"}`} aria-hidden />
            {n.title}
          </span>
          {n.body}
        </p>
      ))}
    </div>
  );
}
