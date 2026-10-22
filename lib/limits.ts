// Design Ref: DESIGN.md §5 — 배포 환경 한도 확인(PLAN 7번) 결과를 한 곳에 둔다.
// 점검 API(PLAN 8번)와 업로드 화면(PLAN 10번)이 같은 값을 쓰게 하려는 것이다.
//
// 근거: Vercel Functions의 요청 본문 한도는 4.5MB, 처리 시간은 기본 300초이다
//       (Vercel 공식 문서 "Vercel Functions Limits", 2026-08-24 갱신).

/**
 * 파일 한 개의 최대 크기 (4MB = 4,194,304바이트).
 * 요청에 모델 이름 등이 함께 실리므로 한도 4.5MB보다 조금 낮게 잡았다.
 */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** 사용자에게 보여 줄 크기 제한 문구 */
export const MAX_FILE_LABEL = "4MB";

/**
 * 점검 API가 최대로 기다릴 시간(초). 파일 하나에 AI를 두 번 부르는데 실측 17~32초(2026-10, gpt-6.1-sol)라서
 * 기본값(300초)보다 짧게 두어, 응답이 멈췄을 때 오래 붙잡혀 있지 않게 한다. 라우트에서 `maxDuration`으로 쓴다.
 */
export const CHECK_MAX_DURATION_SECONDS = 120;
