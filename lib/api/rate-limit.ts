// Design Ref: DESIGN.md §5 7번 — 로그인이 없어서 점검 주소가 비용을 쓸 수 있으므로, 짧은 시간 안의 요청 수를 제한한다.
//
// 서버 인스턴스의 메모리에서 세므로 인스턴스가 여러 개이거나 다시 시작되면 따로 센다. 완전한 방어가 아니라 최선의 방어선이며,
// 진짜 보호는 배포 전에 정할 접속 보호(배포 보호·비밀번호)이다.

export interface RateLimiter {
  /** 요청 1건을 받아도 되면 true 로 기록하고, 한도를 넘으면 false 와 몇 초 뒤에 다시 시도할지를 돌려준다 */
  take(now?: number): { ok: true } | { ok: false; retryAfterSeconds: number };
}

export function createRateLimiter(max: number, windowMs: number): RateLimiter {
  let times: number[] = [];
  return {
    take(now = Date.now()) {
      times = times.filter((t) => now - t < windowMs);
      if (times.length >= max) {
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((times[0] + windowMs - now) / 1000)) };
      }
      times.push(now);
      return { ok: true };
    },
  };
}
