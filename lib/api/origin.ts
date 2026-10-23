// 다른 사이트에서 몰래 보내는 요청(CSRF)을 막는다. 브라우저는 다른 사이트에서 보내는 POST에 Origin 헤더를 항상 붙이므로,
// Origin 이 있는데 이 서버의 주소와 다르면 거절한다. Origin 이 없는 요청(서버끼리·curl·시험)은 브라우저가 아니므로 통과시킨다.
// 이 파일은 일반 함수만 있어서 화면 없이 시험할 수 있다 (scripts/check_security.mjs).

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
