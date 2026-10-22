// Design Ref: DESIGN.md §2.1-2 — GET /api/alio/institutions: 알리오 본부 기관 목록과 조회 칸 선택지.
import { connection } from "next/server";
import { alioHandlers } from "@/lib/api/alio-instance";

export async function GET() {
  // 요청이 올 때 실행한다. 빌드할 때 알리오를 부르지 않게 한다.
  await connection();
  return alioHandlers.handleInstitutions();
}
