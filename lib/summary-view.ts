// Design Ref: DESIGN.md §1.2 ③ — 점검이 모두 끝나면 기관별 요약과 순위를 만든다.
// Plan SC: PLAN.md 12번 — 기관별 요약 화면에 쓸 데이터. 순위 계산 자체는 lib/aggregate.ts 의 summarize 가 한다.
//          PLAN.md 10번 — 알리오에서 가져온 보고서 중 점검 기준이 없는 항목·보고서가 없는 항목은 순위에 넣지 않는다.
//
// 결과 표(lib/result-view.ts)와 같이 파일 이름이 아니라 화면의 파일 번호(id)로 파일을 구분한다.
import { summarize } from "./aggregate.ts";
import type { ItemType } from "./checklist.ts";
import { ITEM_TYPES, isAlioSkipped } from "./result-view.ts";
import type { ViewInput } from "./result-view.ts";
import type { FileResult, Summary } from "./types.ts";

/** 알리오에서 가져온 보고서 중 점검 기준이 없어 AI 대조를 하지 않은 건 수 (요약에 "순위에 넣지 않았다"고 알릴 때 쓴다) */
export function uncheckedCount(inputs: readonly ViewInput[]): number {
  return inputs.filter((i) => isAlioSkipped(i) && i.alio?.outcome === "extracted-only").length;
}

/**
 * 화면 상태에서 기관별 요약을 만든다.
 *
 * 아직 점검 중이거나 대기 중인 파일이 하나라도 있으면 null 을 돌려준다. 점검이 덜 끝난 상태에서 순위를 보이면
 * 끝나지 않은 파일의 항목이 "업로드되지 않음"으로 보이고 순위도 흔들리기 때문이다 (DESIGN §1.2: 점검이 끝나면 나타남).
 *
 * 알리오에서 가져온 보고서가 하나라도 있으면 "올라와야 하는 항목"은 담당자가 고른 항목 중 점검 기준이 있는 것만으로 정하고,
 * 빠진 항목은 "업로드되지 않음" 대신 "알리오에서 보고서를 찾지 못함"으로 알린다. 점검 기준이 없는 항목과 보고서가 없는 건은 순위 계산에 넣지 않는다.
 *
 * @param inputs 점검을 시작한 파일들
 * @param choices 중복에서 담당자가 고른 파일. { [choiceKey]: 파일 번호(문자열) }
 * @param alioItemTypes 알리오에서 가져오려고 고른 항목 중 점검 기준이 있는 항목 종류. 알리오 보고서가 없으면 비워 둔다
 */
export function buildSummary(
  inputs: readonly ViewInput[],
  choices: Readonly<Record<string, string>> = {},
  alioItemTypes: readonly ItemType[] = [],
): Summary | null {
  if (inputs.length === 0) return null;
  if (inputs.some((i) => i.phase === "waiting" || i.phase === "running")) return null;

  const results: FileResult[] = inputs
    .filter((i) => !isAlioSkipped(i))
    .map((i) => {
      const fileName = String(i.id);
      if (i.phase === "done" && i.result) return { ...i.result, fileName };
      // 서버에 연결하지 못한 파일은 점검 실패로 본다. 순위와 지적 수에는 들어가지 않는다.
      return {
        fileName,
        status: "failed",
        reason: i.reason ?? "점검 실패",
        institution: null,
        itemType: null,
        extracted: [],
        findings: [],
        elapsedMs: 0,
        model: "",
      };
    });

  const hasAlio = inputs.some((i) => i.alio);
  const required = hasAlio && alioItemTypes.length > 0 ? alioItemTypes : ITEM_TYPES;
  return summarize(results, required, choices, hasAlio ? { notUploaded: "알리오에서 보고서를 찾지 못함" } : {});
}
