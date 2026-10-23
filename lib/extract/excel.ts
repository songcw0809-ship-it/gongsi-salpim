// Design Ref: DESIGN.md §2.2 ② — 엑셀은 시트명과 칸 주소를 원문 위치로 쓴다.
// 허용 형식은 .xlsx 이다 (exceljs는 옛 .xls를 읽지 못한다).
import ExcelJS from "exceljs";
import type { ExtractResult, TextUnit } from "../types";
import { checkZipSize } from "./zip-guard.ts";

export async function extractExcel(data: Uint8Array): Promise<ExtractResult> {
  // 열기 전에 압축을 풀면 얼마나 커지는지부터 본다 (압축 폭탄 방어)
  const zip = checkZipSize(data);
  if (!zip.ok) return { status: "failed", reason: `엑셀을 읽을 수 없음 (${zip.reason})` };
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(data) as unknown as ArrayBuffer);

    const units: TextUnit[] = [];
    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          const text = cell.text.trim();
          if (text) units.push({ location: `${sheet.name}!${cell.address}`, text });
        });
      });
    });

    if (units.length === 0) {
      return { status: "unreadable", reason: "글자를 읽을 수 없음" };
    }
    return { status: "ok", units };
  } catch {
    return { status: "failed", reason: "엑셀을 읽을 수 없음 (파일이 손상되었거나 형식이 올바르지 않을 수 있음)" };
  }
}
