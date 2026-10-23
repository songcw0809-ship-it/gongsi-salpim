"use client";

// Design Ref: DESIGN.md §1.2 ①② — 시작 화면(AI 모델, 알리오에서 가져오기, 파일 올리기, 진행 상태)과 결과 표·요약·상세.
// Plan SC: PLAN.md 10번(시작 화면, 알리오 항목·기관 선택), 11번(결과 표, 중복 고르기, 다시 시도), 12·13번(요약, 상세).
import { useCallback, useRef, useState } from "react";
import AlioPicker from "@/components/AlioPicker";
import type { AlioSelection } from "@/components/AlioPicker";
import FileResultTable from "@/components/FileResultTable";
import FindingDetailPanel from "@/components/FindingDetailPanel";
import InstitutionSummaryTable from "@/components/InstitutionSummaryTable";
import { FALLBACK_MODEL, MODELS } from "@/lib/ai/models";
import type { AlioCheckResponse } from "@/lib/alio/api-types";
import { requestAlioCheck } from "@/lib/alio/check-client";
import type { AlioItem } from "@/lib/alio/items";
import { expandRequests } from "@/lib/alio/selection";
import { requestCheck } from "@/lib/check-client";
import { MAX_FILE_LABEL } from "@/lib/limits";
import { maskText } from "@/lib/mask";
import { formatSize, precheck } from "@/lib/precheck";
import { buildDetail } from "@/lib/detail-view";
import { buildResultRows } from "@/lib/result-view";
import type { ResultRow, ViewInput } from "@/lib/result-view";
import { MAX_CONCURRENT_CHECKS, runPool } from "@/lib/run-pool";
import { buildSummary, uncheckedCount } from "@/lib/summary-view";
import type { FileResult } from "@/lib/types";

/** rejected·ready 는 점검 전, 나머지는 점검을 시작한 파일 */
type Phase = "rejected" | "ready" | "waiting" | "running" | "done" | "error";

interface Row {
  id: number;
  file: File;
  phase: Phase;
  /** 처리 불가·실패 이유 */
  reason?: string;
  result?: FileResult;
}

/** 알리오에서 가져오는 보고서 한 건 (기관 1곳 × 항목 1종) */
interface AlioRow {
  id: number;
  apbaId: string;
  institutionName: string;
  item: AlioItem;
  phase: "waiting" | "running" | "done" | "error";
  response?: AlioCheckResponse;
  /** 서버에 연결하지 못했거나 서버가 거절했을 때의 이유 */
  reason?: string;
}

const alioLabel = (r: AlioRow) => `${r.institutionName} · ${r.item.name}`;

/** 알리오 건을 결과 표·요약이 쓰는 모양으로 바꾼다 */
function alioToView(r: AlioRow): ViewInput {
  const base = { id: r.id, fileName: alioLabel(r) };
  const info = { institutionName: r.institutionName, itemName: r.item.name, formNo: r.item.formNo ?? undefined, disclosureNo: r.response?.disclosureNo };
  if (r.phase === "waiting" || r.phase === "running") {
    return { ...base, phase: r.phase, alio: { ...info, period: null, outcome: "request-failed" } };
  }
  if (r.phase === "error" || !r.response) {
    return { ...base, phase: "error", reason: r.reason, alio: { ...info, period: null, outcome: "request-failed" } };
  }
  const res = r.response;
  // 알리오에서 못 가져온 건은 다시 시도할 수 있게 "실패"로 보인다
  if (res.outcome === "fetch-failed") {
    return { ...base, phase: "error", reason: res.reason, alio: { ...info, period: res.period, outcome: "fetch-failed" } };
  }
  return { ...base, phase: "done", result: res.result, alio: { ...info, period: res.period, outcome: res.outcome } };
}

export default function StartScreen() {
  const [model, setModel] = useState(FALLBACK_MODEL);
  const [rows, setRows] = useState<Row[]>([]);
  const [alioRows, setAlioRows] = useState<AlioRow[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** 알리오 가져오기를 시작했을 때 이미 가져온 건을 건너뛴 수 안내 */
  const [skipNotice, setSkipNotice] = useState<string | null>(null);
  /** 중복에서 담당자가 고른 파일. { [기관·항목 열쇠]: 파일 번호 } */
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [retryingIds, setRetryingIds] = useState<ReadonlySet<number>>(new Set());
  /** 상세 패널에 보이고 있는 기관 이름 */
  const [selected, setSelected] = useState<string | null>(null);
  const nextId = useRef(1);
  const closeDetail = useCallback(() => setSelected(null), []);

  const patch = (id: number, change: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...change } : r)));
  const patchAlio = (id: number, change: Partial<AlioRow>) =>
    setAlioRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...change } : r)));

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const added: Row[] = Array.from(list).map((file) => {
      const check = precheck(file);
      return check.ok
        ? { id: nextId.current++, file, phase: "ready" }
        : { id: nextId.current++, file, phase: "rejected", reason: `처리 불가: ${check.reason}` };
    });
    setRows((prev) => [...prev, ...added]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function check(row: Row) {
    patch(row.id, { phase: "running", reason: undefined });
    const outcome = await requestCheck(row.file, model);
    if (outcome.ok) patch(row.id, { phase: "done", result: outcome.result, reason: undefined });
    else patch(row.id, { phase: "error", result: undefined, reason: outcome.error });
  }

  async function checkAlio(row: AlioRow) {
    patchAlio(row.id, { phase: "running", reason: undefined });
    const outcome = await requestAlioCheck(row.apbaId, row.item.formNo as string, model);
    if (outcome.ok) patchAlio(row.id, { phase: "done", response: outcome.data, reason: undefined });
    else patchAlio(row.id, { phase: "error", response: undefined, reason: outcome.error });
  }

  async function start() {
    const targets = rows.filter((r) => r.phase === "ready");
    if (targets.length === 0 || running) return;
    setRunning(true);
    setRows((prev) => prev.map((r) => (r.phase === "ready" ? { ...r, phase: "waiting" } : r)));
    await runPool(targets, MAX_CONCURRENT_CHECKS, check);
    setRunning(false);
  }

  async function startAlio(selection: AlioSelection) {
    if (running) return;
    const wanted = expandRequests(selection.institutions, selection.items);
    // 이미 가져온 같은 기관·항목은 다시 가져오지 않는다 (같은 보고서가 두 번 들어와 중복이 되는 것을 막음)
    const existing = new Set(alioRows.map((r) => `${r.apbaId}/${r.item.formNo}`));
    const fresh = wanted.filter((w) => !existing.has(`${w.institution.id}/${w.item.formNo}`));
    setSkipNotice(fresh.length < wanted.length ? `이미 가져온 ${wanted.length - fresh.length}건은 건너뛰었습니다.` : null);
    if (fresh.length === 0) return;
    const added: AlioRow[] = fresh.map((w) => ({
      id: nextId.current++,
      apbaId: w.institution.id,
      institutionName: w.institution.name,
      item: w.item,
      phase: "waiting",
    }));
    setAlioRows((prev) => [...prev, ...added]);
    setRunning(true);
    await runPool(added, MAX_CONCURRENT_CHECKS, checkAlio);
    setRunning(false);
  }

  async function retry(resultRow: ResultRow) {
    const id = resultRow.id;
    if (retryingIds.has(id)) return;
    const file = rows.find((r) => r.id === id);
    const alio = alioRows.find((r) => r.id === id);
    if (!file && !alio) return;
    setRetryingIds((prev) => new Set(prev).add(id));
    if (file) await check(file);
    else if (alio) await checkAlio(alio);
    setRetryingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function choose(resultRow: ResultRow) {
    if (!resultRow.choiceKey) return;
    const key = resultRow.choiceKey;
    setChoices((prev) => ({ ...prev, [key]: String(resultRow.id) }));
  }

  function clearResults() {
    setRows((prev) => prev.filter((r) => r.phase === "ready" || r.phase === "rejected"));
    setAlioRows([]);
    setChoices({});
    setSelected(null);
    setSkipNotice(null);
  }

  const beforeStart = rows.filter((r) => r.phase === "ready" || r.phase === "rejected");
  const started = rows.filter((r) => r.phase !== "ready" && r.phase !== "rejected");
  // 파일과 알리오 건을 입력 순서(번호)대로 합쳐 결과 표·요약에 넘긴다
  const viewInputs: ViewInput[] = [
    ...started.map((r) => ({
      id: r.id,
      fileName: r.file.name,
      phase: r.phase as "waiting" | "running" | "done" | "error",
      result: r.result,
      reason: r.reason,
    })),
    ...alioRows.map(alioToView),
  ].sort((a, b) => a.id - b.id);
  const resultRows = buildResultRows(viewInputs, choices);
  // 알리오에서 고른 항목 중 점검 기준이 있는 항목 종류. 요약에서 "올라와야 하는 항목"을 정할 때 쓴다
  const alioItemTypes = [...new Set(alioRows.map((r) => r.item.checklist).filter((t): t is NonNullable<typeof t> => Boolean(t)))];
  // 점검이 모두 끝나면 기관별 요약과 순위를 보인다 (끝나기 전에는 null)
  const summary = buildSummary(viewInputs, choices, alioItemTypes);
  const nameOf = (key: string) =>
    rows.find((r) => String(r.id) === key)?.file.name ??
    (() => {
      const a = alioRows.find((r) => String(r.id) === key);
      return a ? alioLabel(a) : key;
    })();
  // 점검을 다시 시도하는 동안에는 요약이 사라지므로 패널도 함께 닫힌다
  const selectedRow = summary?.institutions.find((i) => i.institution === selected);
  const detail = selectedRow ? buildDetail(selectedRow, nameOf, (key) => alioRows.some((r) => String(r.id) === key)) : null;
  const readyCount = rows.filter((r) => r.phase === "ready").length;
  const rejectedCount = rows.filter((r) => r.phase === "rejected").length;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="model-title" className="card flex flex-col gap-1.5">
        <h2 id="model-title" className="sr-only">
          AI 모델
        </h2>
        <label htmlFor="model" className="text-sm font-bold text-[var(--ink)]">
          AI 모델
        </label>
        <select
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={running}
          className="field w-full max-w-xs"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id} ({m.note})
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">한 번의 점검은 고른 모델 하나로 모든 보고서를 처리합니다. 알리오에서 가져오기와 파일 올리기에 똑같이 적용됩니다.</p>
      </section>

      <AlioPicker disabled={running} onStart={startAlio} />
      {skipNotice && (
        <p role="status" className="-mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {skipNotice}
        </p>
      )}

      <section
        aria-labelledby="upload-title"
        className="flex flex-col gap-5 card"
      >
        <div>
          <h2 id="upload-title" className="card-title">
            공시 파일 올리기 <span className="text-sm font-normal text-zinc-500">(알리오에서 가져올 수 없는 자료용)</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-500">파일로 올리면 기관명과 항목 종류를 AI가 읽어 분류합니다.</p>
        </div>

        <label
          htmlFor="files"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
            dragging
              ? "border-amber-400 bg-amber-50"
              : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700"
          }`}
        >
          <span className="font-medium">여기에 파일을 끌어다 놓거나 눌러서 선택하세요</span>
          <span className="text-sm text-zinc-500">
            PDF · 엑셀(.xlsx) · 파일당 {MAX_FILE_LABEL} 이하 · 여러 개 가능
          </span>
          <input
            id="files"
            type="file"
            multiple
            accept=".pdf,.xlsx"
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {beforeStart.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">
              점검할 파일 ({beforeStart.length}개{rejectedCount > 0 ? ` · 처리 불가 ${rejectedCount}개` : ""})
            </h3>
            <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {beforeStart.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span aria-hidden>{row.phase === "rejected" ? "✕" : "·"}</span>
                  <span className="min-w-0 flex-1 truncate" title={maskText(row.file.name)}>
                    {maskText(row.file.name)}
                  </span>
                  <span className="text-xs text-zinc-500">{formatSize(row.file.size)}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      row.phase === "rejected"
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {row.phase === "rejected" ? "처리 불가" : "대기 전"}
                  </span>
                  <button type="button" onClick={() => removeRow(row.id)} className="text-xs text-zinc-500 underline">
                    빼기
                  </button>
                  {row.reason && <p className="basis-full pl-5 text-xs text-zinc-600 dark:text-zinc-400">{row.reason}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {running && <span className="text-sm text-zinc-500">점검 중입니다. 한 건에 30초 안팎이 걸립니다.</span>}
          <button
            type="button"
            onClick={start}
            disabled={running || readyCount === 0}
            className="btn-primary"
          >
            점검 시작{readyCount > 0 ? ` (${readyCount}개)` : ""}
          </button>
        </div>
      </section>

      {resultRows.length > 0 && (
        <>
          <FileResultTable rows={resultRows} onChoose={choose} onRetry={retry} retryingIds={retryingIds} />
          <div className="-mt-4 flex justify-end">
            <button type="button" onClick={clearResults} disabled={running} className="text-xs text-zinc-500 underline disabled:opacity-40">
              결과 모두 지우기
            </button>
          </div>
        </>
      )}

      {summary && (
        <InstitutionSummaryTable summary={summary} nameOf={nameOf} onSelect={setSelected} uncheckedCount={uncheckedCount(viewInputs)} />
      )}

      {detail && <FindingDetailPanel detail={detail} onClose={closeDetail} />}
    </div>
  );
}
