// 알리오 가져오기 창구 인스턴스. 기관 목록 캐시와 요청 수 제한이 서버 인스턴스 안에서 이어지도록 한 번만 만든다.
import { createAlioHandlers } from "./alio-handler.ts";

export const alioHandlers = createAlioHandlers();
