// Design Ref: DESIGN.md §2.1-2 — POST /api/alio/check: 기관 1곳 × 항목 1종을 알리오에서 가져와 점검한다.
// 처리는 lib/api/alio-handler.ts 에 있다.
import { alioHandlers } from "@/lib/api/alio-instance";

// 알리오 조회 2~3번(간격 포함 몇 초) + AI 호출 최대 2번(실측 17~32초)이다. /api/check 와 같이 120초로 둔다.
// 라우트 설정은 빌드 때 정적으로 읽혀서 상수를 불러 쓰지 않고 숫자를 직접 적는다 (lib/limits.ts 의 CHECK_MAX_DURATION_SECONDS 와 같은 값).
export const maxDuration = 120;

export async function POST(request: Request) {
  return alioHandlers.handleCheck(request);
}
