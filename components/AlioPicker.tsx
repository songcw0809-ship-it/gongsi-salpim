"use client";

// Design Ref: DESIGN.md §1.2 ① — 알리오에서 가져오기: 공시 항목(여러 개)과 기관 유형·주무 부처로 조회한 기관(최대 10곳)을 고른다.
// Plan SC: PLAN.md 10번 — 항목 체크, 기관 유형·주무 부처 조회, 기관 10곳·기관×항목 20건 한도(넘기면 더 고르지 못하고 이유를 알림).
import { useEffect, useMemo, useState } from "react";
import { fetchInstitutions } from "@/lib/alio/check-client";
import type { Institution } from "@/lib/alio/client";
import { filterInstitutions } from "@/lib/alio/filter";
import { ALIO_ITEMS, FETCHABLE_ITEMS } from "@/lib/alio/items";
import type { AlioItem } from "@/lib/alio/items";
import type { AlioInstitutionsResponse } from "@/lib/alio/api-types";
import { canAddInstitution, canAddItem, requestCount, startBlockReason } from "@/lib/alio/selection";
import { ALIO_MAX_INSTITUTIONS, ALIO_MAX_REQUESTS } from "@/lib/limits";

export interface AlioSelection {
  institutions: Institution[];
  items: AlioItem[];
}

interface Props {
  /** 점검 중에는 고르기를 잠근다 */
  disabled: boolean;
  onStart: (selection: AlioSelection) => void;
}

const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export default function AlioPicker({ disabled, onStart }: Props) {
  const [load, setLoad] = useState<{ state: "loading" } | { state: "error"; error: string } | { state: "ready"; data: AlioInstitutionsResponse }>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [formNos, setFormNos] = useState<string[]>([]);
  const [instIds, setInstIds] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [ministries, setMinistries] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");

  useEffect(() => {
    let alive = true;
    fetchInstitutions().then((r) => {
      if (!alive) return;
      setLoad(r.ok ? { state: "ready", data: r.data } : { state: "error", error: r.error });
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const institutions = useMemo(() => (load.state === "ready" ? load.data.institutions : []), [load]);
  const filtered = useMemo(() => filterInstitutions(institutions, { types, ministries, query }), [institutions, types, ministries, query]);
  const itemsShown = useMemo(() => {
    const q = squash(itemQuery);
    return q ? FETCHABLE_ITEMS.filter((i) => squash(`${i.no}${i.name}`).includes(q)) : FETCHABLE_ITEMS;
  }, [itemQuery]);
  const unavailable = ALIO_ITEMS.filter((i) => !FETCHABLE_ITEMS.includes(i));

  const sel = { institutions: instIds.length, items: formNos.length };
  const count = requestCount(sel);
  const blocked = startBlockReason(sel);
  const chosenInstitutions = instIds.map((id) => institutions.find((i) => i.id === id)).filter((i): i is Institution => Boolean(i));
  const chosenItems = formNos.map((no) => FETCHABLE_ITEMS.find((i) => i.formNo === no)).filter((i): i is AlioItem => Boolean(i));

  const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const instAllowed = canAddInstitution(sel);
  const itemAllowed = canAddItem(sel);

  return (
    <section aria-labelledby="alio-title" className="flex flex-col gap-5 card">
      <div>
        <h2 id="alio-title" className="card-title">
          알리오에서 보고서 가져오기
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          공시 항목과 기관을 고르면 알리오에서 그 기관들의 보고서를 가져와 점검합니다. 한 번에 기관은 최대 {ALIO_MAX_INSTITUTIONS}곳, 기관×항목은 최대 {ALIO_MAX_REQUESTS}건입니다.
        </p>
      </div>

      {/* 공시 항목 */}
      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold text-[var(--ink)]"><span className="step-badge">1</span>공시 항목 (하나 이상)</legend>
        <input
          type="search"
          value={itemQuery}
          onChange={(e) => setItemQuery(e.target.value)}
          placeholder="항목 이름이나 번호로 찾기"
          aria-label="공시 항목 찾기"
          className="field w-full max-w-xs"
        />
        <ul className="max-h-60 overflow-y-auto panel overflow-hidden">
          {itemsShown.map((item) => {
            const checked = formNos.includes(item.formNo as string);
            const blockedHere = !checked && !itemAllowed.ok;
            return (
              <li key={item.formNo} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                <label title={blockedHere && !itemAllowed.ok ? itemAllowed.reason : undefined} className={`flex items-center gap-2 px-3 py-1.5 text-sm ${blockedHere ? "opacity-40" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={blockedHere}
                    onChange={() => setFormNos((prev) => toggle(prev, item.formNo as string))}
                  />
                  <span className="w-10 shrink-0 text-xs text-zinc-500">{item.no}</span>
                  <span className="min-w-0 flex-1">{item.name}</span>
                  {item.checklist ? (
                    <span className="badge-green shrink-0">점검 기준 있음</span>
                  ) : (
                    <span className="shrink-0 text-xs text-zinc-400">값만 추출</span>
                  )}
                </label>
              </li>
            );
          })}
          {itemsShown.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">찾는 항목이 없습니다</li>}
        </ul>
        <p className="text-xs text-zinc-500">
          &ldquo;점검 기준 있음&rdquo;(임원 연봉·직원 평균보수)만 AI가 기준과 대조합니다. 나머지 항목은 보고서를 가져와 값만 뽑고 &ldquo;점검 기준 준비 중&rdquo;으로 표시합니다.
        </p>
        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer">가져올 수 없는 항목 {unavailable.length}개 (수시 보고서·게시판 등, 준비 중)</summary>
          <ul className="mt-1 grid gap-x-4 sm:grid-cols-2">
            {unavailable.map((i) => (
              <li key={`${i.no}-${i.name}`} className="text-zinc-400">
                {i.no} {i.name} <span className="text-zinc-400">({i.schedule} · {i.kind})</span>
              </li>
            ))}
          </ul>
        </details>
      </fieldset>

      {/* 기관 */}
      <fieldset disabled={disabled} className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-bold text-[var(--ink)]"><span className="step-badge">2</span>기관 (최대 {ALIO_MAX_INSTITUTIONS}곳)</legend>
        {load.state === "loading" && <p className="text-sm text-zinc-500">알리오 기관 목록을 불러오는 중입니다…</p>}
        {load.state === "error" && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
            <span>기관 목록을 가져오지 못했습니다: {load.error}</span>
            <button
              type="button"
              onClick={() => {
                setLoad({ state: "loading" });
                setAttempt((n) => n + 1);
              }}
              className="rounded-md border border-red-300 px-2 py-0.5 text-xs"
            >
              다시 시도
            </button>
          </div>
        )}
        {load.state === "ready" && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">기관 유형</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {load.data.filters.types.map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={types.includes(t)} onChange={() => setTypes((p) => toggle(p, t))} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">주무 부처 ({load.data.filters.ministries.length}곳)</span>
              <div className="flex max-h-28 flex-wrap gap-x-4 gap-y-1 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                {load.data.filters.ministries.map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={ministries.includes(m)} onChange={() => setMinistries((p) => toggle(p, m))} />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="기관 이름으로 찾기"
              aria-label="기관 찾기"
              className="field w-full max-w-xs"
            />
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>
                조회 결과 {filtered.length}곳 / 전체 {institutions.length}곳 (유형·부처를 고르면 그 조건에 맞는 기관만 보입니다)
              </span>
              {(types.length > 0 || ministries.length > 0 || query) && (
                <button
                  type="button"
                  onClick={() => {
                    setTypes([]);
                    setMinistries([]);
                    setQuery("");
                  }}
                  className="underline"
                >
                  조건 지우기
                </button>
              )}
            </div>
            <ul className="max-h-64 overflow-y-auto panel overflow-hidden">
              {filtered.map((inst) => {
                const checked = instIds.includes(inst.id);
                const blockedHere = !checked && !instAllowed.ok;
                return (
                  <li key={inst.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                    <label title={blockedHere && !instAllowed.ok ? instAllowed.reason : undefined} className={`flex items-center gap-2 px-3 py-1.5 text-sm ${blockedHere ? "opacity-40" : "cursor-pointer"}`}>
                      <input type="checkbox" checked={checked} disabled={blockedHere} onChange={() => setInstIds((p) => toggle(p, inst.id))} />
                      <span className="min-w-0 flex-1">{inst.name}</span>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {inst.type} · {inst.ministry}
                      </span>
                    </label>
                  </li>
                );
              })}
              {filtered.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">조건에 맞는 기관이 없습니다</li>}
            </ul>
          </>
        )}
      </fieldset>

      {/* 선택 요약과 시작 */}
      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        {chosenInstitutions.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="고른 기관">
            {chosenInstitutions.map((i) => (
              <li key={i.id} className="flex items-center gap-1 rounded-full bg-amber-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-amber-900">
                {i.name}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setInstIds((p) => p.filter((id) => id !== i.id))}
                  aria-label={`${i.name} 빼기`}
                  className="rounded-full px-1.5 text-[var(--ink)] hover:bg-amber-200"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" role="status">
            선택: 항목 {formNos.length}개 × 기관 {instIds.length}곳 = <strong>{count}건</strong>{" "}
            <span className="text-zinc-500">(최대 기관 {ALIO_MAX_INSTITUTIONS}곳 · {ALIO_MAX_REQUESTS}건)</span>
            {(!instAllowed.ok || !itemAllowed.ok) && count > 0 && (
              <span className="block text-xs text-amber-800 dark:text-amber-300">
                {!instAllowed.ok ? instAllowed.reason : !itemAllowed.ok ? itemAllowed.reason : ""}
              </span>
            )}
          </p>
          <button
            type="button"
            disabled={disabled || blocked !== null || load.state !== "ready"}
            title={blocked ?? undefined}
            onClick={() => onStart({ institutions: chosenInstitutions, items: chosenItems })}
            className="btn-primary"
          >
            알리오에서 가져와 점검{count > 0 ? ` (${count}건)` : ""}
          </button>
        </div>
        {blocked && load.state === "ready" && <p className="text-xs text-zinc-500">{blocked}</p>}
      </div>
    </section>
  );
}
