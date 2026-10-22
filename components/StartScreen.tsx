"use client";

// Design Ref: DESIGN.md §1.2 ① — 시작 화면: AI 모델 고르기, 파일 올리기(보조 방법), 진행 상태.
// Plan SC: PLAN.md 10번 — 모델 선택, 처리 불가 파일 표시, 진행 상태 표시.
// 알리오에서 가져오기는 PLAN 9-1·9-2(서버 코드) 뒤에 이 화면에 붙인다. 지금은 자리만 잡아 두었다.
import { useRef, useState } from "react";
import { FALLBACK_MODEL, MODELS } from "@/lib/ai/models";
import { requestCheck } from "@/lib/check-client";
import { MAX_FILE_LABEL } from "@/lib/limits";
import { formatSize, precheck } from "@/lib/precheck";
import { MAX_CONCURRENT_CHECKS, runPool } from "@/lib/run-pool";
import type { FileResult } from "@/lib/types";

type Phase = "rejected" | "ready" | "waiting" | "running" | "done" | "error";

interface Row {
  id: number;
  file: File;
  phase: Phase;
  /** 처리 불가·실패 이유 */
  reason?: string;
  result?: FileResult;
}

const PHASE_LABEL: Record<Phase, string> = {
  rejected: "처리 불가",
  ready: "대기 전",
  waiting: "대기",
  running: "점검 중",
  done: "완료",
  error: "점검 실패",
};

/** 파일 한 줄의 결과 문구. 의심 항목이 없어도 "이상 없음"이라고 쓰지 않는다(PRD 5번 M2). */
function summaryOf(row: Row): string {
  if (row.phase === "rejected" || row.phase === "error") return row.reason ?? "";
  const r = row.result;
  if (!r) return "";
  if (r.status === "unreadable") return `처리 불가: ${r.reason ?? "글자를 읽을 수 없음"}`;
  if (r.status === "failed") return `점검 실패: ${r.reason ?? "알 수 없는 오류"}`;
  if (r.findings.length === 0) return "발견된 의심 항목 없음. AI가 놓쳤을 수 있으니 담당자 확인이 필요합니다";
  const high = r.findings.filter((f) => f.confidence === "높음").length;
  return `오류 가능성 ${r.findings.length}건 (신뢰도 높음 ${high}건)`;
}

/** 배지 문구. 서버가 200으로 돌려준 "읽을 수 없음"·"점검 실패"도 "완료"로 보이지 않게 한다. */
function badgeOf(row: Row): string {
  if (row.phase === "done") {
    if (row.result?.status === "unreadable") return "처리 불가";
    if (row.result?.status === "failed") return "점검 실패";
  }
  return PHASE_LABEL[row.phase];
}

function isBad(row: Row): boolean {
  return (
    row.phase === "rejected" ||
    row.phase === "error" ||
    row.result?.status === "unreadable" ||
    row.result?.status === "failed"
  );
}

export default function StartScreen() {
  const [model, setModel] = useState(FALLBACK_MODEL);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const nextId = useRef(1);

  const patch = (id: number, change: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...change } : r)));

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

  async function start() {
    const targets = rows.filter((r) => r.phase === "ready");
    if (targets.length === 0 || running) return;
    setRunning(true);
    setRows((prev) => prev.map((r) => (r.phase === "ready" ? { ...r, phase: "waiting" } : r)));
    await runPool(targets, MAX_CONCURRENT_CHECKS, async (row) => {
      patch(row.id, { phase: "running" });
      const outcome = await requestCheck(row.file, model);
      if (outcome.ok) patch(row.id, { phase: "done", result: outcome.result });
      else patch(row.id, { phase: "error", reason: outcome.error });
    });
    setRunning(false);
  }

  const readyCount = rows.filter((r) => r.phase === "ready").length;
  const rejectedCount = rows.filter((r) => r.phase === "rejected").length;

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="alio-title"
        className="rounded-lg border border-dashed border-zinc-300 p-5 dark:border-zinc-700"
      >
        <h2 id="alio-title" className="text-lg font-semibold">
          알리오에서 보고서 가져오기
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          공시 항목과 기관(최대 10곳)을 골라 알리오에서 보고서를 바로 가져오는 기능은 준비 중입니다. 지금은 아래에서
          파일을 직접 올려 주세요.
        </p>
      </section>

      <section
        aria-labelledby="upload-title"
        className="flex flex-col gap-5 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
      >
        <h2 id="upload-title" className="text-lg font-semibold">
          공시 파일 올리기
        </h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="model" className="text-sm font-medium">
            AI 모델
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={running}
            className="w-full max-w-xs rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm dark:border-zinc-700"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} ({m.note})
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500">한 번의 점검은 고른 모델 하나로 모든 파일을 처리합니다.</p>
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
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors ${
            dragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
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

        {rows.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">
              선택한 파일 ({rows.length}개{rejectedCount > 0 ? ` · 처리 불가 ${rejectedCount}개` : ""})
            </h3>
            <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span aria-hidden>{isBad(row) ? "✕" : row.phase === "done" ? "✓" : "·"}</span>
                  <span className="min-w-0 flex-1 truncate" title={row.file.name}>
                    {row.file.name}
                  </span>
                  <span className="text-xs text-zinc-500">{formatSize(row.file.size)}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      isBad(row)
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                        : row.phase === "done"
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {badgeOf(row)}
                  </span>
                  {(row.phase === "ready" || row.phase === "rejected") && (
                    <button type="button" onClick={() => removeRow(row.id)} className="text-xs text-zinc-500 underline">
                      빼기
                    </button>
                  )}
                  {summaryOf(row) && (
                    <p className="basis-full pl-5 text-xs text-zinc-600 dark:text-zinc-400">{summaryOf(row)}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {running && <span className="text-sm text-zinc-500">점검 중입니다. 파일마다 30초 안팎이 걸립니다.</span>}
          <button
            type="button"
            onClick={start}
            disabled={running || readyCount === 0}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-40"
          >
            점검 시작{readyCount > 0 ? ` (${readyCount}개)` : ""}
          </button>
        </div>
      </section>
    </div>
  );
}
