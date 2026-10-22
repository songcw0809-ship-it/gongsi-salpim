# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 프로젝트

**경영공시 AI 점검기**: 재정경제부 공공정책국 경영관리과 담당자가 공공기관 경영공시 파일(PDF·엑셀) 여러 개를 올리면, 앱에 내장한 통합공시 기준 체크리스트와 AI로 대조해 기준에 어긋난 의심 항목을 기관별로 보여 주는 Next.js 앱이다. 요구사항의 기준 문서는 [PRD.md](PRD.md)이며, 기능이나 범위가 헷갈리면 코드보다 PRD를 먼저 확인한다. 만들 순서는 PRD 9번 "개발 단위"를 따른다.

## 명령어

```bash
npm run dev        # 개발 서버 (http://localhost:3000)
npm run build      # 프로덕션 빌드
npm run lint       # ESLint 전체 (next lint 아님, `eslint` 직접 실행)
npx eslint app/page.tsx   # 파일 하나만 린트
npx tsc --noEmit   # 타입 검사
```

테스트 도구는 아직 설정돼 있지 않다.

## 구조

- App Router, `src/` 없이 루트의 `app/`을 쓴다. 경로 별칭은 `@/*` → 프로젝트 루트.
- Next.js 16.4.2 / React 19.3. [next.config.ts](next.config.ts)에 `cacheComponents`와 `partialPrefetching`이 켜져 있어서, 데이터 가져오기·캐싱·라우트 핸들러를 쓰기 전에 `node_modules/next/dist/docs/01-app/`의 해당 문서(특히 `01-getting-started/08-caching.md`, `15-route-handlers.md`)를 읽는다.
- Tailwind CSS 4를 Turbopack 로더(`@tailwindcss/turbopack`)로 처리한다. 설정은 `next.config.ts`의 `turbopack.rules`에 있다.
- 레이아웃 props 타입은 전역 헬퍼 `LayoutProps<"/">`를 쓴다(`app/layout.tsx` 참고).
- 현재 `app/`은 create-next-app 기본 상태이고 점검 기능은 아직 구현되지 않았다.

## 도메인 규칙

점검 기준과 AI 동작은 아래 문서가 정한다. 코드를 짜기 전에 확인한다.

- [PRD.md](PRD.md) 5번 "AI가 지킬 규칙": 근거 조항·원문 위치가 없는 지적은 버린다, "오류입니다" 대신 "오류 가능성"과 신뢰도(높음·중간·낮음)로 표현한다, 의심 항목이 없을 때 "이상 없음"이라 쓰지 않는다, 앱은 파일을 자동 수정하거나 기관에 연락하지 않는다.
- 점검 기준은 「공공기관의 통합공시에 관한 기준」(2025.12.30 개정) 별표 1의 10번(임원연봉)·11번(직원 평균보수)과 제3조·제6조를 체크리스트로 정리해 앱에 내장한 것만 쓴다. 각 기준에는 조항 또는 별표 번호를 붙인다. 체크리스트 원안은 [docs/sample-data-plan.md](docs/sample-data-plan.md)에 있다.
- 시연·검증용 샘플은 같은 문서의 기관 6곳 × 항목 2종 구성(심은 오류 11개)을 정답지로 쓴다. 기관과 수치는 모두 가짜이며, 실제 비공개 공시 자료는 업로드하지 않는다.
- 업로드 파일은 서버에 저장하지 않는다(PRD 6·7번). 영구 저장, 로그인, 알리오 연동은 비범위다.

## 환경변수

- 비밀 값은 `.env`에만 두고 서버 코드에서만 읽는다. `NEXT_PUBLIC_` 접두어를 붙이지 않는다. `.env`는 `.gitignore`에 등록돼 있다.
- `.env`에 있는 키 이름: `GITHUB_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, `OPENAI_API_KEY`. 값을 출력하거나 대화에 옮기지 않는다.

## 작업 절차 (검증 루프)

작업마다 아래를 반복한다.

1. 변경한다.
2. `npm run lint`와 `npm run build`를 실행해 오류가 없는지 확인한다.
3. 화면이 바뀐 작업이면 `npm run dev`로 띄워 실제로 보이는지 확인한다.
4. 문제가 있으면 고치고 다시 1번으로 돌아간다.
5. 통과하면 git 커밋으로 그 상태를 남긴다. 커밋 메시지는 한국어로 무엇을 왜 바꿨는지 한 줄로 쓴다. 검증을 통과하지 못한 상태는 커밋하지 않는다.
6. 무엇을 왜 바꿨는지 한 줄로 요약해 알려준다.

## 작업 절차 (브랜치)

- 새 기능이나 눈에 띄는 변경을 시작할 때는 먼저 main에서 작업용 브랜치를 만들고 그 브랜치에서 작업한다. 브랜치 이름은 `feature/기능이름` 형태로, 한글 없이 영문으로 짓는다.
- 커밋은 그 작업 브랜치에만 쌓는다. main에서 직접 작업하지 않는다.
- 검증을 통과해 작업이 끝나도 main에 바로 합치지 않는다. "합칠 준비가 됐다"고 사용자에게 알리고, 사용자가 확인한 뒤 병합해 달라고 말하면 그때 main에 합친다.
