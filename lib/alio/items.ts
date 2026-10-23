// Design Ref: DESIGN.md §2.1-2 — 알리오 공시항목 목록. docs/alio-items.md 의 표를 코드로 옮긴 것이다.
// Plan SC: PLAN.md 9-1 — 공시항목 목록과 항목 번호를 코드에 두고, 가져올 수 있는 항목("정기 · 보고서")만 고르게 한다.
//
// 알리오 [기관별 공시] 상세 화면의 표를 2026-10-22에 읽은 값이다(번호 1~50-2, 93행).
// 알리오가 항목을 바꾸면 이 표도 고쳐야 한다. 항목 번호(formNo)는 각 행의 "보기"가 여는 주소의 reportFormRootNo 이다.
import type { ItemType } from "../checklist.ts";

export interface AlioItem {
  /** 알리오 공시항목 번호. 같은 번호가 여러 행에 쓰이므로 구분에는 formNo 를 쓴다. 예: "22-2" */
  no: string;
  name: string;
  /** 알리오 항목 번호(reportFormRootNo). 찾지 못한 항목은 null */
  formNo: string | null;
  schedule: "정기" | "수시";
  kind: "보고서" | "게시판";
  /** 공시 시기. 수시 항목은 빈 문자열 */
  period: string;
  /** 내장 점검 기준(체크리스트)이 있는 항목이면 그 항목 종류 */
  checklist?: ItemType;
}

export const ALIO_ITEMS: readonly AlioItem[] = [
  { no: "1", name: "일반현황", formNo: "10105", schedule: "수시", kind: "보고서", period: "" },
  { no: "2", name: "내부규정", formNo: "21110", schedule: "수시", kind: "게시판", period: "" },
  { no: "3", name: "임직원 수", formNo: "2020", schedule: "정기", kind: "보고서", period: "매분기", checklist: "임직원수" },
  { no: "4", name: "임원현황", formNo: "20305", schedule: "수시", kind: "보고서", period: "" },
  { no: "5", name: "신규채용 현황", formNo: "2040", schedule: "정기", kind: "보고서", period: "매분기", checklist: "신규채용" },
  { no: "6-1", name: "임원 모집공고", formNo: "B1010", schedule: "수시", kind: "게시판", period: "" },
  { no: "6-2", name: "직원 채용정보", formNo: "B1020", schedule: "수시", kind: "게시판", period: "" },
  { no: "7-1", name: "퇴직 임·직원 재취업 현황", formNo: "3192", schedule: "정기", kind: "보고서", period: "매분기" },
  { no: "7-2", name: "남녀 이직자 비율", formNo: "21801", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "8-1", name: "징계제도 운영현황", formNo: "2120", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "8-2", name: "징계처분 결과", formNo: "2121", schedule: "정기", kind: "보고서", period: "매분기" },
  { no: "9", name: "임원 국외출장 내역", formNo: "20905", schedule: "수시", kind: "보고서", period: "" },
  { no: "10", name: "임원 연봉", formNo: "2050", schedule: "정기", kind: "보고서", period: "1분기", checklist: "임원연봉" },
  { no: "11", name: "직원 평균보수", formNo: "2060", schedule: "정기", kind: "보고서", period: "1분기", checklist: "직원평균보수" },
  { no: "12", name: "기관장 업무추진비", formNo: "20701", schedule: "정기", kind: "보고서", period: "1분기", checklist: "기관장업무추진비" },
  { no: "13", name: "복리후생비", formNo: "20801", schedule: "정기", kind: "보고서", period: "1분기", checklist: "복리후생비" },
  { no: "14-1", name: "그 밖의 복리후생제도 등의 운영현황", formNo: "63701", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "14-2", name: "복리후생 자체점검 결과", formNo: "B1280", schedule: "정기", kind: "게시판", period: "" },
  { no: "15-1", name: "노동조합 가입정보", formNo: "2102", schedule: "정기", kind: "보고서", period: "매분기" },
  { no: "15-2", name: "복수노조 교섭창구 단일화 정보", formNo: "21025", schedule: "수시", kind: "보고서", period: "" },
  { no: "15-3", name: "단체협약 정보", formNo: "21026", schedule: "수시", kind: "보고서", period: "" },
  { no: "15-4", name: "임금협약 정보", formNo: "21027", schedule: "수시", kind: "보고서", period: "" },
  { no: "15-5", name: "노사협의회 의결사항", formNo: "21028", schedule: "수시", kind: "보고서", period: "" },
  { no: "15-6", name: "제도 운영 상황", formNo: "63787", schedule: "수시", kind: "보고서", period: "" },
  { no: "15-7", name: "단체협약상 별도 합의사항", formNo: "63795", schedule: "수시", kind: "보고서", period: "" },
  { no: "15-8", name: "단체협약 외의 별도 합의사항", formNo: "63796", schedule: "수시", kind: "보고서", period: "" },
  { no: "16-1", name: "소송 및 소송대리인 현황", formNo: "2130", schedule: "정기", kind: "보고서", period: "매분기" },
  { no: "16-2", name: "고문변호사 및 법률자문 현황", formNo: "2131", schedule: "정기", kind: "보고서", period: "매분기" },
  { no: "17", name: "AI 활용현황", formNo: "80402", schedule: "정기", kind: "보고서", period: "2분기" },
  { no: "18", name: "ESG 경영 및 운영위원회 현황", formNo: "80104", schedule: "정기", kind: "보고서", period: "4분기" },
  { no: "19-1", name: "온실가스 감축실적", formNo: "70423", schedule: "정기", kind: "보고서", period: "3분기" },
  { no: "19-2", name: "저공해 자동차 현황", formNo: "21662", schedule: "정기", kind: "보고서", period: "2분기" },
  { no: "19-3", name: "대기오염물질 배출량", formNo: "21672", schedule: "정기", kind: "보고서", period: "2분기" },
  { no: "20-1", name: "에너지 사용량", formNo: "21621", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "20-2", name: "폐기물 발생량", formNo: "21631", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "20-3", name: "용수 사용량", formNo: "21641", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "20-4", name: "화학물질 배출량", formNo: "21681", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "20-5", name: "수질오염물질 배출량", formNo: "21691", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "21-1", name: "녹색제품 구매실적", formNo: "70413", schedule: "정기", kind: "보고서", period: "3분기" },
  { no: "21-2", name: "환경법규 위반 현황", formNo: "B1270", schedule: "수시", kind: "게시판", period: "" },
  { no: "21-3", name: "환경오염피해 구제 배상 현황", formNo: "B1290", schedule: "수시", kind: "게시판", period: "" },
  { no: "22-1", name: "안전관리현황(안전경영책임보고서)", formNo: "70401", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "22-1", name: "안전관리현황(안전관리등급)", formNo: "70442", schedule: "정기", kind: "보고서", period: "2분기" },
  { no: "22-2", name: "산업재해 사고 사망자수 및 안전사고 사망자 수(발생)", formNo: "7045", schedule: "정기", kind: "보고서", period: "매분기" },
  { no: "22-2", name: "산업재해 사고 사망자 수 및 안전사고 사망자 수(승인)", formNo: "70461", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "22-2", name: "중대재해에 해당하는 부상자수", formNo: "70471", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "23", name: "정보보호", formNo: "70432", schedule: "정기", kind: "보고서", period: "2분기" },
  { no: "24", name: "사회공헌 활동", formNo: "21502", schedule: "정기", kind: "보고서", period: "2분기" },
  { no: "25", name: "인권경영", formNo: "21702", schedule: "정기", kind: "보고서", period: "2분기" },
  { no: "26", name: "일·가정 양립 지원제도 및 양성평등 운영현황", formNo: "21401", schedule: "정기", kind: "보고서", period: "1분기", checklist: "일가정양립" },
  { no: "27-1", name: "동반성장 평가결과", formNo: "40102", schedule: "정기", kind: "보고서", period: "2분기" },
  { no: "27-2", name: "협력사 ESG 지원실적", formNo: "40202", schedule: "정기", kind: "보고서", period: "2분기" },
  { no: "28", name: "장애인 고용현황", formNo: "80202", schedule: "정기", kind: "보고서", period: "2분기", checklist: "장애인고용" },
  { no: "29-1", name: "혁신조달 구매실적", formNo: "70312", schedule: "정기", kind: "보고서", period: "2분기" },
  { no: "29-2", name: "중증장애인 생산품 구매실적", formNo: "70322", schedule: "정기", kind: "보고서", period: "2분기" },
  { no: "29-3", name: "중소기업 생산품 구매실적", formNo: "80332", schedule: "정기", kind: "보고서", period: "2분기" },
  { no: "30-1", name: "이사회 회의록", formNo: "43005", schedule: "수시", kind: "보고서", period: "" },
  { no: "30-2", name: "개별 비상임이사 활동내용", formNo: "43009", schedule: "수시", kind: "보고서", period: "" },
  { no: "31", name: "자체 감사부서 현황", formNo: "32311", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "32", name: "청렴도 평가결과", formNo: "40211", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "33", name: "요약 재무상태표", formNo: "3120", schedule: "정기", kind: "보고서", period: "공기업(1,3분기) 그외(1분기)" },
  { no: "34", name: "요약손익계산서(또는 요약 포괄손익계산서)", formNo: "3130", schedule: "정기", kind: "보고서", period: "공기업(1,3분기) 그외(1분기)" },
  { no: "35", name: "수입·지출현황", formNo: "31401", schedule: "정기", kind: "보고서", period: "1분기", checklist: "수입지출" },
  { no: "36", name: "자본금 및 주주현황", formNo: "31701", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "37", name: "장단기 차입금 현황", formNo: "3180", schedule: "정기", kind: "보고서", period: "공기업(1,3분기) 그외(1분기)" },
  { no: "38-1", name: "외부회계 감사보고서", formNo: "32301", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "38-2", name: "내부·외부 감사결과", formNo: "43006", schedule: "수시", kind: "보고서", period: "" },
  { no: "39-1", name: "법인세", formNo: "32211", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "39-2", name: "세무 확정내역", formNo: "32225", schedule: "수시", kind: "보고서", period: "" },
  { no: "39-3", name: "조세포탈현황", formNo: "32226", schedule: "수시", kind: "보고서", period: "" },
  { no: "40", name: "주요사업", formNo: "31501", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "41", name: "투자집행내역", formNo: "3160", schedule: "정기", kind: "보고서", period: "매분기" },
  { no: "42-1", name: "투자 및 출자 현황", formNo: "31901", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "42-2", name: "대규모 거래내역", formNo: "31935", schedule: "수시", kind: "보고서", period: "" },
  { no: "42-4", name: "신규 시설 투자", formNo: "31965", schedule: "수시", kind: "보고서", period: "" },
  { no: "42-5", name: "출연 현황", formNo: "32001", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "43-1", name: "경영부담 비용추계", formNo: "32101", schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "43-2", name: "기타 경영상 부담이 될 사항", formNo: "32135", schedule: "수시", kind: "보고서", period: "" },
  { no: "44", name: "중장기 재무관리계획", formNo: "32603", schedule: "정기", kind: "보고서", period: "3분기" },
  { no: "45", name: "주요기관의 상세부채 정보", formNo: null, schedule: "정기", kind: "보고서", period: "1분기" },
  { no: "46-1", name: "경영실적 평가결과[공기업,준정부]", formNo: "B1230", schedule: "정기", kind: "게시판", period: "" },
  { no: "46-1", name: "경영실적 평가결과[기타공공기관]", formNo: "42605", schedule: "수시", kind: "보고서", period: "" },
  { no: "46-2", name: "경영실적 평가 조치계획 및 시정조치 결과", formNo: "4270", schedule: "정기", kind: "보고서", period: "3,4분기" },
  { no: "46-3", name: "기관장 평가결과", formNo: "B1300", schedule: "정기", kind: "게시판", period: "" },
  { no: "46-4", name: "감사직무실적 평가결과", formNo: "B1250", schedule: "정기", kind: "게시판", period: "" },
  { no: "47-1", name: "국회지적사항", formNo: "B1210", schedule: "수시", kind: "게시판", period: "" },
  { no: "47-2", name: "감사원 지적사항", formNo: "B1220-P2200", schedule: "수시", kind: "게시판", period: "" },
  { no: "47-3", name: "주무부처 지적사항", formNo: "B1220-P2300", schedule: "수시", kind: "게시판", period: "" },
  { no: "48", name: "고객만족도 조사결과", formNo: "B1240", schedule: "정기", kind: "게시판", period: "" },
  { no: "49-1", name: "입찰공고", formNo: "B1030", schedule: "수시", kind: "게시판", period: "" },
  { no: "49-2", name: "수의계약", formNo: "7030", schedule: "정기", kind: "보고서", period: "매분기" },
  { no: "50-1", name: "자체 연구 보고서", formNo: "B1040", schedule: "수시", kind: "게시판", period: "" },
  { no: "50-2", name: "외부용역 연구 보고서", formNo: "B1260", schedule: "수시", kind: "게시판", period: "" },
];

/** 이번에 가져올 수 있는 항목: "정기 · 보고서"이고 항목 번호를 아는 것. 나머지는 가져오는 방법을 확인하지 못했다. */
export function isFetchable(item: AlioItem): boolean {
  return item.schedule === "정기" && item.kind === "보고서" && item.formNo !== null;
}

export const FETCHABLE_ITEMS: readonly AlioItem[] = ALIO_ITEMS.filter(isFetchable);

/** 항목 번호(formNo)로 가져올 수 있는 항목을 찾는다. 서버가 요청의 항목을 이 목록과 대조할 때 쓴다. */
export function findFetchableItem(formNo: unknown): AlioItem | undefined {
  return typeof formNo === "string" ? FETCHABLE_ITEMS.find((i) => i.formNo === formNo) : undefined;
}
