// Design Ref: DESIGN.md §1.1 — 안내 띠: 외부 AI 전송 고지, 저장하지 않음·새로고침하면 사라짐, 개인정보 안내 (항상 표시).
// Plan SC: PLAN.md 14번 — 알리오에서 가져온 자료도 포함해 외부 AI 전송 고지, 새로고침하면 결과가 사라진다는 안내, 개인정보 안내 (PRD 7번).

export default function NoticeBanner() {
  return (
    <div
      role="note"
      aria-label="이용 안내"
      className="flex flex-col gap-1.5 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p>
        <strong className="font-semibold">외부 AI로 전송됩니다.</strong> 올린 파일과 알리오에서 가져온 보고서의 내용이 점검을 위해 외부 AI 서비스로 전송됩니다.
      </p>
      <p>
        <strong className="font-semibold">저장하지 않습니다.</strong> 파일, 가져온 보고서, 점검 결과는 서버에 저장하지 않고 이 화면 안에만 있습니다. 새로고침하거나 창을 닫으면 모두 사라지니, 필요한 내용은 그 전에 직접 옮겨 적어 두세요.
      </p>
      <p>
        <strong className="font-semibold">개인정보 안내.</strong> 경영공시 자료에는 원칙적으로 개인정보가 없지만 담당자 이름이나 연락처가 섞여 있을 수 있습니다. 전화번호·이메일·주민등록번호로 보이는 값은 화면에서 가려 보여 주지만, 번호의 형태만 보고 가리므로 놓치는 값이 있을 수 있고 AI로 전송되는 원본에는 그대로 들어 있습니다.
      </p>
    </div>
  );
}
