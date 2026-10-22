// Design Ref: DESIGN.md §2.2 ⑥ — 결과 모으기: 중복·기관별 묶기·업로드되지 않은 항목 찾기.
// Plan SC: PLAN.md 4번 — "기관 미확인"·"항목 종류 미확인"·"중복"·"업로드되지 않음" 표시 규칙.
// 순위 계산(summarize)은 PLAN 9번에서 더했다.
//
// 이 파일은 일반 함수만 있어서 AI 호출 없이 단독으로 시험할 수 있다.
import type { ItemType } from "./checklist";
import type {
  ClassifiedFile,
  Confidence,
  FileResult,
  InstitutionGroup,
  InstitutionSummary,
  ItemSlot,
  Organized,
  OrganizedFile,
  Summary,
} from "./types";

export const LABEL = {
  unknownInstitution: "기관 미확인",
  unknownItemType: "항목 종류 미확인",
  // 기관이 제출하지 않았다고 단정하지 않는다 (PRD 5번 M2).
  notUploaded: "업로드되지 않음",
  duplicate: "중복",
} as const;

const squash = (s: string) => s.normalize("NFC").replace(/\s+/g, "");

/** AI가 돌려준 기관명을 다듬는다. 비어 있으면 null("기관 미확인"). 추측하지 않는다. */
export function normalizeInstitution(raw: string | null | undefined): string | null {
  const name = raw?.normalize("NFC").replace(/\s+/g, " ").trim();
  return name ? name : null;
}

/**
 * AI가 돌려준 항목 종류를 알려진 항목 종류 중 하나로 맞춘다. 띄어쓰기 차이만 허용하고,
 * 목록에 없는 말은 null("항목 종류 미확인")로 둔다. AI가 새 항목 종류를 지어내지 못하게 한다.
 */
export function normalizeItemType(
  raw: string | null | undefined,
  known: readonly ItemType[],
): ItemType | null {
  if (!raw) return null;
  const key = squash(raw);
  return known.find((k) => squash(k) === key) ?? null;
}

/** 중복에서 고른 파일을 기억해 둘 때 쓰는 열쇠. 띄어쓰기가 달라도 같은 기관이면 같은 열쇠. */
export function slotKey(institution: string, itemType: ItemType): string {
  return `${squash(institution)}|${itemType}`;
}

/**
 * 파일들을 화면에 보일 상태로 정리한다.
 *
 * @param files 글자를 뽑고 분류까지 끝난 파일들
 * @param requiredItemTypes 기관마다 올라와야 하는 항목 종류 (체크리스트에서 가져온다)
 * @param choices 중복에서 담당자가 고른 파일. { [slotKey]: 파일 이름 }
 */
export function organize(
  files: readonly ClassifiedFile[],
  requiredItemTypes: readonly ItemType[],
  choices: Readonly<Record<string, string>> = {},
): Organized {
  const out: OrganizedFile[] = files.map((f) => ({
    fileName: f.fileName,
    state: "ready",
    institutionLabel: f.institution ?? LABEL.unknownInstitution,
    itemTypeLabel: f.itemType ?? LABEL.unknownItemType,
  }));
  const unassigned: string[] = [];

  type Group = { name: string; byItem: Map<ItemType, number[]> };
  const groups = new Map<string, Group>();

  files.forEach((f, i) => {
    if (f.status === "unreadable") {
      out[i].state = "unreadable";
      out[i].note = f.reason ?? "글자를 읽을 수 없음";
      return;
    }
    if (f.status === "failed") {
      out[i].state = "failed";
      out[i].note = f.reason ?? "점검 실패";
      return;
    }
    const institution = normalizeInstitution(f.institution);
    if (!institution || !f.itemType) {
      out[i].state = "unclassified";
      out[i].note = !institution ? LABEL.unknownInstitution : LABEL.unknownItemType;
      unassigned.push(f.fileName);
      return;
    }
    const key = squash(institution);
    const group = groups.get(key) ?? { name: institution, byItem: new Map() };
    group.byItem.set(f.itemType, [...(group.byItem.get(f.itemType) ?? []), i]);
    groups.set(key, group);
  });

  const institutions: InstitutionGroup[] = [...groups.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
    .map((group) => {
      const present = [...group.byItem.keys()];
      const itemTypes = [
        ...requiredItemTypes,
        ...present.filter((t) => !requiredItemTypes.includes(t)),
      ];

      const slots: ItemSlot[] = itemTypes.map((itemType) => {
        const idx = group.byItem.get(itemType) ?? [];
        const fileNames = idx.map((i) => files[i].fileName);

        if (idx.length === 0) {
          return { itemType, fileNames, status: "missing", label: LABEL.notUploaded };
        }
        if (idx.length === 1) {
          return { itemType, fileNames, status: "uploaded", label: "" };
        }

        // 같은 기관·같은 항목 종류의 파일이 2개 이상: 어느 쪽을 쓸지 임의로 정하지 않는다.
        const chosen = choices[slotKey(group.name, itemType)];
        if (chosen && fileNames.includes(chosen)) {
          let picked = false;
          for (const i of idx) {
            if (files[i].fileName === chosen && !picked) {
              picked = true;
              out[i].note = "사용할 파일로 선택됨";
            } else {
              out[i].state = "excluded";
              out[i].note = "같은 항목의 다른 파일이 선택되어 쓰지 않음";
            }
          }
          return { itemType, fileNames, status: "uploaded", chosen, label: "" };
        }
        for (const i of idx) {
          out[i].state = "duplicate";
          out[i].note = "같은 기관·같은 항목 파일이 2개 이상입니다. 사용할 파일을 고르세요";
        }
        return { itemType, fileNames, status: "duplicate", label: LABEL.duplicate };
      });

      return {
        institution: group.name,
        slots,
        hasUnresolvedDuplicate: slots.some((s) => s.status === "duplicate"),
      };
    });

  return { files: out, institutions, unassigned };
}

/** 순위를 어떻게 정했는지. 화면에 순위와 함께 보여 준다 (PRD 5번 M2). */
export const RANK_BASIS =
  "신뢰도 높음 지적 수가 많은 순, 같으면 의심 항목 수가 많은 순, 그래도 같으면 기관명 가나다순";

const CONFIDENCES: Confidence[] = ["높음", "중간", "낮음"];

/**
 * 점검 결과들을 기관별로 묶어 지적 수를 세고 순위를 매긴다.
 *
 * - 순위는 RANK_BASIS 대로 정한다.
 * - 같은 기관·같은 항목 파일이 2개 이상이고 담당자가 아직 고르지 않았으면, 그 칸의 지적은 세지 않는다.
 *   (둘 다 세면 한 기관의 지적 수가 두 배가 된다.) 고르면 다시 계산하면 된다.
 * - 순위에 쓸 점검 결과가 하나도 없는 기관(전부 중복 미해결이거나 올라온 칸이 없음)은 순위에서 뺀다.
 *   지적이 0개인 기관과 "아직 모르는" 기관을 구분하기 위해서이다.
 * - 기관 미확인·항목 종류 미확인·처리 불가·점검 실패 파일은 순위에 영향을 주지 않는다.
 *
 * @param results 파일마다의 점검 결과 (lib/check-file.ts 의 FileResult)
 * @param requiredItemTypes 기관마다 올라와야 하는 항목 종류
 * @param choices 중복에서 담당자가 고른 파일. { [slotKey]: 파일 이름 }
 */
export function summarize(
  results: readonly FileResult[],
  requiredItemTypes: readonly ItemType[],
  choices: Readonly<Record<string, string>> = {},
): Summary {
  const classified: ClassifiedFile[] = results.map((r) => ({
    fileName: r.fileName,
    status: r.status,
    institution: r.institution,
    itemType: r.itemType,
    reason: r.reason,
  }));
  const organized = organize(classified, requiredItemTypes, choices);

  const byName = new Map<string, FileResult>();
  for (const r of results) if (!byName.has(r.fileName)) byName.set(r.fileName, r);

  const rows: InstitutionSummary[] = organized.institutions.map((g) => {
    const countsByConfidence: Record<Confidence, number> = { 높음: 0, 중간: 0, 낮음: 0 };
    const findings: InstitutionSummary["findings"] = [];

    for (const slot of g.slots) {
      if (slot.status !== "uploaded") continue; // 중복 미해결·업로드되지 않음은 세지 않는다
      const fileName = slot.chosen ?? slot.fileNames[0];
      const result = byName.get(fileName);
      if (!result) continue;
      for (const finding of result.findings) {
        countsByConfidence[finding.confidence]++;
        findings.push({ itemType: slot.itemType, fileName, finding });
      }
    }
    findings.sort(
      (a, b) =>
        CONFIDENCES.indexOf(a.finding.confidence) - CONFIDENCES.indexOf(b.finding.confidence),
    );

    const missingItemTypes = g.slots.filter((s) => s.status === "missing").map((s) => s.itemType);
    const notes: string[] = [];
    if (g.hasUnresolvedDuplicate) notes.push("중복 선택 필요");
    if (missingItemTypes.length > 0) notes.push(`${LABEL.notUploaded}: ${missingItemTypes.join(", ")}`);

    return {
      institution: g.institution,
      rank: null,
      highCount: countsByConfidence["높음"],
      findingCount: findings.length,
      countsByConfidence,
      slots: g.slots,
      hasUnresolvedDuplicate: g.hasUnresolvedDuplicate,
      missingItemTypes,
      note: notes.length > 0 ? notes.join(" · ") : null,
      findings,
    };
  });

  const hasCounted = (row: InstitutionSummary) => row.slots.some((s) => s.status === "uploaded");
  const byName2 = (a: InstitutionSummary, b: InstitutionSummary) =>
    a.institution.localeCompare(b.institution, "ko");

  const ranked = rows
    .filter(hasCounted)
    .sort((a, b) => b.highCount - a.highCount || b.findingCount - a.findingCount || byName2(a, b));
  ranked.forEach((row, i) => (row.rank = i + 1));
  const unranked = rows.filter((r) => !hasCounted(r)).sort(byName2);

  return {
    rankBasis: RANK_BASIS,
    institutions: [...ranked, ...unranked],
    files: organized.files,
    unassigned: organized.unassigned,
  };
}
