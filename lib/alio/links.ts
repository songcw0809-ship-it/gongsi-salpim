// 알리오 화면으로 바로가기 · 보고서 PDF 받기 주소를 만든다. 브라우저가 알리오에 직접 접속하는 링크이며 앱 서버는 거치지 않는다.
// 이 파일은 일반 함수만 있어서 화면 없이 시험할 수 있다 (scripts/check_links.mjs).
import { ALIO_ORIGIN } from "./client.ts";

/** 알리오의 그 공시항목 화면(예: 임원연봉). 항목 번호는 숫자만 받는다 */
export function alioItemUrl(formNo: string): string | null {
  return /^\d{3,5}$/.test(formNo) ? `${ALIO_ORIGIN}/item/itemOrganList.do?reportFormRootNo=${formNo}` : null;
}

/** 알리오에 올라온 보고서 PDF. 공시번호는 숫자만 받는다 */
export function alioPdfUrl(disclosureNo: string): string | null {
  return /^\d{4,20}$/.test(disclosureNo) ? `${ALIO_ORIGIN}/download/pdf.json?disclosureNo=${disclosureNo}` : null;
}
