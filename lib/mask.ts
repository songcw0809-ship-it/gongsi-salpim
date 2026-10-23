// Design Ref: DESIGN.md §1.3 — 개인정보로 보이는 값(전화번호·이메일·주민등록번호 형태)은 화면에 표시할 때 가린다.
// Plan SC: PLAN.md 14번 — 개인정보로 보이는 값 가림 (PRD 7번).
//
// 화면에 보일 때만 가린다. AI에게는 원본 글자가 그대로 전송되고, 가린 뒤의 값은 화면 안에서만 쓴다(검증 장치는 원본으로 대조한다).
// 형태만 보고 가리므로 놓치는 개인정보가 있을 수 있고, 반대로 개인정보가 아닌 값이 가려질 수도 있다.
// 공시 표에는 금액·연도·사업자등록번호처럼 숫자가 많아서, 번호 형태가 분명한 것만 가린다.
// 이 파일은 일반 함수만 있어서 화면 없이 시험할 수 있다 (scripts/check_mask.mjs).

/** 가린 자리에 쓰는 문구. 어떤 종류를 가렸는지 알 수 있게 적는다. */
export const MASK = {
  email: "[이메일 가림]",
  rrn: "[주민등록번호 가림]",
  phone: "[전화번호 가림]",
} as const;

// 앞뒤에 숫자나 하이픈이 더 붙은 긴 번호의 일부(예: 사업자등록번호, 계좌번호)는 건드리지 않는다.
const NOT_IN_NUMBER_BEFORE = "(?<![\\d-])";
const NOT_IN_NUMBER_AFTER = "(?![\\d-])";

// 이메일: 아이디@도메인.최상위
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

// 주민등록번호: 생년월일 6자리 - 뒷자리 7자리(첫 숫자 1~8). 하이픈이 없는 13자리 숫자는 금액 등과 구분할 수 없어 가리지 않는다.
const RRN = new RegExp(`${NOT_IN_NUMBER_BEFORE}\\d{6}-[1-8]\\d{6}${NOT_IN_NUMBER_AFTER}`, "g");

// 전화번호: 지역번호·휴대폰 번호(02, 031~064, 070, 010 등, 050x)로 시작하고 구분 기호(- . 공백)가 있는 형태,
// 그리고 구분 기호 없는 휴대폰 번호(01x로 시작하는 10~11자리).
const PHONE_SEPARATED = new RegExp(
  `${NOT_IN_NUMBER_BEFORE}0(?:2|[3-6][1-5]|70|1[016-9]|50\\d?)[-. ]\\d{3,4}[-. ]\\d{4}${NOT_IN_NUMBER_AFTER}`,
  "g",
);
const PHONE_MOBILE_PLAIN = /(?<!\d)01[016-9]\d{7,8}(?!\d)/g;

export interface Masked {
  text: string;
  /** 가린 값의 수 */
  count: number;
}

/** 글자 안의 개인정보로 보이는 값을 가린다. */
export function maskPii(input: string): Masked {
  let count = 0;
  const swap = (pattern: RegExp, label: string) => (s: string) =>
    s.replace(pattern, () => {
      count++;
      return label;
    });
  // 이메일을 먼저 가려야 이메일 안의 숫자가 전화번호로 잘못 읽히지 않는다
  const text = [swap(EMAIL, MASK.email), swap(RRN, MASK.rrn), swap(PHONE_SEPARATED, MASK.phone), swap(PHONE_MOBILE_PLAIN, MASK.phone)].reduce(
    (s, fn) => fn(s),
    input,
  );
  return { text, count };
}

/** 가린 글자만 필요할 때 */
export function maskText(input: string): string {
  return maskPii(input).text;
}

/** 여러 글자를 한꺼번에 가리고 가린 값의 총 수를 센다 */
export function maskAll(inputs: readonly (string | undefined)[]): { texts: (string | undefined)[]; count: number } {
  let count = 0;
  const texts = inputs.map((s) => {
    if (s === undefined) return undefined;
    const m = maskPii(s);
    count += m.count;
    return m.text;
  });
  return { texts, count };
}
