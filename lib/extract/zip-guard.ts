// 압축 폭탄 방어: .xlsx 는 zip 파일이다. 작게 압축된 파일이 풀리면서 아주 커지면 서버 메모리가 바닥나므로,
// 열기 전에 zip 목록(파일 끝의 중앙 디렉터리)만 읽어 "풀린 크기의 합"과 파일 수를 본다. 내용은 풀지 않는다.
// 이 파일은 일반 함수만 있어서 화면 없이 시험할 수 있다 (scripts/check_security.mjs).

/** 풀린 크기의 합 상한 */
export const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;
/** zip 안의 파일 수 상한 (정상 엑셀은 수십 개) */
export const MAX_ZIP_ENTRIES = 2000;

export type ZipCheck = { ok: true } | { ok: false; reason: string };

export function checkZipSize(data: Uint8Array): ZipCheck {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // 파일 끝에서 거슬러 올라가며 "중앙 디렉터리 끝" 표식(PK\x05\x06)을 찾는다 (끝의 설명글은 최대 65535바이트)
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return { ok: false, reason: "zip 구조를 읽을 수 없음" };
  const entries = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (entries > MAX_ZIP_ENTRIES) return { ok: false, reason: "압축 파일 안의 파일이 너무 많음" };

  let total = 0;
  let p = cdOffset;
  for (let n = 0; n < entries; n++) {
    if (p + 46 > data.length || view.getUint32(p, true) !== 0x02014b50) return { ok: false, reason: "zip 구조를 읽을 수 없음" };
    total += view.getUint32(p + 24, true);
    if (total > MAX_UNZIPPED_BYTES) return { ok: false, reason: "압축을 풀면 너무 커짐" };
    p += 46 + view.getUint16(p + 28, true) + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  return { ok: true };
}
