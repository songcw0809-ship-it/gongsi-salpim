// Design Ref: DESIGN.md §2.1 — POST /api/check: 파일 1개를 점검한다. 처리는 lib/api/check-handler.ts 에 있다.
import { handleCheck } from "@/lib/api/check-handler";

// 파일 하나에 AI를 두 번 부르는데 실측 17~32초(2026-10, gpt-6.1-sol)이다. 기본 300초보다 짧게 두어
// 응답이 멈췄을 때 오래 붙잡혀 있지 않게 한다. lib/limits.ts 의 CHECK_MAX_DURATION_SECONDS 와 같은 값이어야 하며,
// 라우트 설정은 빌드 때 정적으로 읽혀서 상수를 불러 쓰지 않고 숫자를 직접 적는다.
export const maxDuration = 120;

export async function POST(request: Request) {
  return handleCheck(request);
}
