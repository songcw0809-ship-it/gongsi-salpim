// Design Ref: DESIGN.md §2.1, §2.3 — 점검 접수 창구. 브라우저가 파일을 한 개씩 보내면 한 개씩 점검해 돌려준다.
// Plan SC: PLAN.md 8번 — PDF·엑셀 형식과 4MB 검사, 파일별 결과, 실패한 파일만 "점검 실패", 처리 시간 측정.
//
// 요청:  POST multipart/form-data
//          file  파일 1개 (.pdf 또는 .xlsx, 4MB 이하)
//          model AI 모델 이름 (생략하면 기본 모델). 허용 목록에 없으면 거절한다.
// 응답:  200  FileResult(JSON). 파일을 읽지 못했거나 AI 호출이 실패해도 200이며, status 가 unreadable / failed 이다.
//        그 밖의 요청 자체의 문제는 { error } 와 함께 400 / 413 / 415 / 500 으로 답한다.
//
// 여러 파일은 브라우저가 이 주소를 파일마다 한 번씩 불러서 처리한다. 그래서 한 파일이 실패해도 나머지는 계속된다.
// route.ts 는 이 함수를 부르기만 한다 (route 파일에는 HTTP 메서드 외에 다른 것을 내보낼 수 없어서 따로 둠).
import { createOpenAiClientFromEnv } from "../ai/openai.ts";
import type { AiClient } from "../ai/analyze.ts";
import { resolveModel } from "../ai/models.ts";
import { checkFile } from "../check-file.ts";
import { MAX_FILE_BYTES, MAX_FILE_LABEL } from "../limits.ts";

const ALLOWED_EXTENSIONS = [".pdf", ".xlsx"];

/** 요청 본문에는 파일 말고도 모델 이름과 경계 문구가 실린다. 미리 거절할 때 그만큼 여유를 둔다. */
const REQUEST_OVERHEAD_BYTES = 64 * 1024;

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function handleCheck(
  request: Request,
  getAi: () => AiClient = createOpenAiClientFromEnv,
): Promise<Response> {
  // 1. 본문을 읽기 전에 크기부터 본다. 한도를 넘는 요청은 읽지 않는다.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_FILE_BYTES + REQUEST_OVERHEAD_BYTES) {
    return fail(413, `파일이 ${MAX_FILE_LABEL}를 넘어 점검할 수 없음`);
  }

  // 2. 요청 모양
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return fail(415, "파일은 multipart/form-data로 보내야 함");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "요청을 읽을 수 없음");
  }

  // 3. AI 모델: 허용 목록에 있는 것만 (PRD 7번). AI를 부르기 전에 거른다.
  const model = resolveModel(form.get("model"));
  if (!model) return fail(400, "허용되지 않은 AI 모델");

  // 4. 파일
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "점검할 파일이 없음");
  if (file.size === 0) return fail(400, "빈 파일");
  if (file.size > MAX_FILE_BYTES) return fail(413, `파일이 ${MAX_FILE_LABEL}를 넘어 점검할 수 없음`);
  const fileName = file.name.slice(-200);
  if (!ALLOWED_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext))) {
    return fail(415, "PDF 또는 엑셀(.xlsx) 파일만 점검할 수 있음");
  }

  // 5. AI 연결. 키가 없어도 위의 검사는 먼저 끝난다. 설정 내용은 밖으로 알리지 않는다.
  let ai: AiClient;
  try {
    ai = getAi();
  } catch {
    return fail(500, "서버 설정 문제로 점검할 수 없음");
  }

  // 6. 점검. 읽을 수 없는 파일, AI 호출 실패는 예외가 아니라 FileResult 의 status 로 돌려준다.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await checkFile({ fileName, bytes, model, ai });
  return Response.json(result);
}
