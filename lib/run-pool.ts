// Design Ref: DESIGN.md §2.1 — 파일을 한 개씩 서버에 보내되 동시에 최대 3개까지만 보낸다.

/** 동시에 보낼 수 있는 최대 요청 수 */
export const MAX_CONCURRENT_CHECKS = 3;

/**
 * items 를 worker 로 처리하되 동시에 limit 개까지만 실행한다. 시작 순서는 입력 순서를 지킨다.
 * worker 는 스스로 오류를 처리하고 던지지 않아야 한다(던지면 그 줄이 멈춘다).
 */
export async function runPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, lane));
}
