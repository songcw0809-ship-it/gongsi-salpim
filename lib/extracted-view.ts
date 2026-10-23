// 추출한 항목·값(평평한 목록)을 알리오 보고서처럼 읽기 쉬운 표로 바꾼다.
//
// AI가 돌려주는 값은 "항목 이름 + 공백으로 이어 붙인 값"이다. 예) "상임기관장 기본급" → "145,092 146,398 148,448 …".
// 이름의 첫 단어가 같은 항목끼리 묶고(상임기관장·상임감사·상임이사 …), "구분" 항목의 연도들을 표의 열 제목으로, "단위"는 표 설명으로 쓴다.
// 짐작이 틀려도 값을 잃지 않도록, 열 수와 맞지 않는 값은 한 칸에 그대로 둔다.
// 이 파일은 일반 함수만 있어서 화면 없이 시험할 수 있다 (scripts/check_extracted.mjs).
import type { ExtractedField } from "./types.ts";

export interface ExtractedRow {
  label: string;
  /** 열 제목이 있고 값이 열 수와 맞으면 열마다 한 칸, 아니면 한 칸 */
  cells: string[];
  /** true 면 cells[0] 한 칸이 모든 열에 걸쳐 보인다 */
  merged: boolean;
  location: string;
}

export interface ExtractedSection {
  title: string;
  /** 예: "단위: 천원". 없으면 null */
  caption: string | null;
  columns: string[];
  rows: ExtractedRow[];
}

const BASIC_TITLE = "기본 정보";
/** 같은 첫 단어를 가진 항목이 이만큼 이상일 때만 한 묶음으로 본다 */
const MIN_GROUP_SIZE = 2;

function split(label: string): { head: string; rest: string } {
  const i = label.indexOf(" ");
  return i < 0 ? { head: label, rest: "" } : { head: label.slice(0, i), rest: label.slice(i + 1).trim() };
}

/** "2021년 결산 2022년 결산 …" → ["2021년 결산", "2022년 결산", …]. 연도가 2개 미만이면 열 제목으로 쓰지 않는다 */
function parseColumns(value: string): string[] {
  const found = value.match(/\d{4}년[^\d]*/g)?.map((s) => s.trim()) ?? [];
  return found.length >= 2 ? found : [];
}

function toCells(value: string, columns: readonly string[]): { cells: string[]; merged: boolean } {
  const n = columns.length;
  const text = value.trim();
  if (n === 0) return { cells: [text], merged: false };
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === n) return { cells: tokens, merged: false };
  // "해당사항 없음 해당사항 없음 …"처럼 한 칸이 여러 단어인 값: 열 수로 똑같이 나눌 수 있을 때만 나눈다
  if (tokens.length > n && tokens.length % n === 0) {
    const size = tokens.length / n;
    return { cells: Array.from({ length: n }, (_, k) => tokens.slice(k * size, (k + 1) * size).join(" ")), merged: false };
  }
  return { cells: [text], merged: true };
}

interface Pending {
  label: string;
  value: string;
  location: string;
}

export function buildExtractedSections(fields: readonly ExtractedField[]): ExtractedSection[] {
  const heads = new Map<string, number>();
  for (const f of fields) {
    const { head, rest } = split(f.label);
    if (rest) heads.set(head, (heads.get(head) ?? 0) + 1);
  }
  const isGroup = (head: string) => (heads.get(head) ?? 0) >= MIN_GROUP_SIZE;

  const byTitle = new Map<string, { section: ExtractedSection; pending: Pending[] }>();
  for (const f of fields) {
    const { head, rest } = split(f.label);
    const title = rest && isGroup(head) ? head : BASIC_TITLE;
    const label = title === BASIC_TITLE ? f.label : rest;
    let entry = byTitle.get(title);
    if (!entry) {
      entry = { section: { title, caption: null, columns: [], rows: [] }, pending: [] };
      byTitle.set(title, entry);
    }
    if (title !== BASIC_TITLE && label.startsWith("구분")) {
      const cols = parseColumns(f.value);
      if (cols.length > 0) {
        entry.section.columns = cols;
        continue;
      }
    }
    if (title !== BASIC_TITLE && label.startsWith("단위")) {
      entry.section.caption = `단위: ${f.value.trim()}`;
      continue;
    }
    entry.pending.push({ label, value: f.value, location: f.location });
  }
  return [...byTitle.values()].map(({ section, pending }) => ({
    ...section,
    rows: pending.map((p) => ({ label: p.label, ...toCells(p.value, section.columns), location: p.location })),
  }));
}
