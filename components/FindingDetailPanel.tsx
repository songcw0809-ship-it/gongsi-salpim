"use client";

// Design Ref: DESIGN.md §1.2 ④ — 의심 항목 상세 패널(오른쪽). 기관을 누르면 열린다.
// Plan SC: PLAN.md 13번 — 근거 기준(번호 포함)·원문 위치·신뢰도 표시, 의심 항목이 없으면 "발견된 의심 항목 없음" 문구.
import { useEffect, useRef } from "react";
import type { Detail } from "@/lib/detail-view";
import type { Confidence } from "@/lib/types";

interface Props {
  detail: Detail;
  onClose: () => void;
}

const CONFIDENCE_CLASS: Record<Confidence, string> = {
  높음: "bg-red-100 text-red-800",
  중간: "bg-yellow-100 text-yellow-900",
  낮음: "bg-blue-100 text-blue-800",
};

export default function FindingDetailPanel({ detail, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div aria-hidden className="fixed inset-0 z-10 bg-black/30 sm:bg-black/10" onClick={onClose} />
      <aside
        aria-label={`${detail.institution} 의심 항목 상세`}
        className="fixed inset-y-3 right-3 z-20 flex w-[calc(100%-1.5rem)] max-w-md flex-col gap-4 overflow-y-auto rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(30,60,130,0.28)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="card-title">{detail.institution}</h2>
            <p className="text-xs text-zinc-500">{detail.rank === null ? "순위에서 제외됨" : `확인 우선순위 ${detail.rank}위`}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="btn-ghost"
          >
            닫기
          </button>
        </div>

        {detail.emptyMessage && (
          <p role="status" className="rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
            {detail.emptyMessage}
          </p>
        )}
        {detail.note && <p className="text-sm text-zinc-600 dark:text-zinc-400">{detail.note}</p>}
        {detail.maskedCount > 0 && (
          <p role="status" className="text-xs text-zinc-500">
            개인정보로 보이는 값 {detail.maskedCount}개를 가려서 보여 줍니다.
          </p>
        )}

        {detail.groups.map((group) => (
          <section key={`${group.itemType}/${group.fileName}`} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">
              {group.itemType} <span className="font-normal text-zinc-500">· {group.fileName}</span>
            </h3>
            <ul className="flex flex-col gap-3">
              {group.items.map((item, i) => (
                <li key={i} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CONFIDENCE_CLASS[item.confidence]}`}>
                      오류 가능성 · 신뢰도 {item.confidence}
                    </span>
                  </div>
                  <p>{item.message}</p>
                  <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-xs">
                    <dt className="text-zinc-500">근거 기준</dt>
                    <dd>
                      <span className="font-medium">{item.ruleId}</span> · 통합공시 기준 {item.source}
                      <br />
                      <span className="text-zinc-600 dark:text-zinc-400">&ldquo;{item.criterion}&rdquo;</span>
                    </dd>
                    <dt className="text-zinc-500">원문 위치</dt>
                    <dd>
                      {item.location}
                      <br />
                      <span className="text-zinc-600 dark:text-zinc-400">&ldquo;{item.quote}&rdquo;</span>
                    </dd>
                  </dl>
                  {item.fix && (
                    <div className="rounded-xl bg-amber-50 p-3 text-xs">
                      <p className="font-bold text-amber-900">이렇게 고치면 좋습니다 (보완 요청 예시)</p>
                      <p className="mt-1">{item.fix.action}</p>
                      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                        예) <span className="font-mono">{item.fix.example}</span>
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-auto border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
          AI가 찾은 의심 항목이며 오류를 확정한 것이 아닙니다. 수정 예시의 금액·이름은 설명을 위한 가짜 값입니다. 판단과 보완 요청은 담당자가 앱 밖에서 직접 하세요(앱은 파일을
          고치거나 기관에 연락하지 않습니다).
        </p>
      </aside>
    </>
  );
}
