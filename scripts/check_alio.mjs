// 알리오 가져오기(lib/alio/)가 DESIGN §2.1-2 대로 동작하는지 확인한다.
//
// 실행:  node scripts/check_alio.mjs          # 가짜 알리오 응답으로 시험 (알리오를 부르지 않음)
//        node scripts/check_alio.mjs --live   # 진짜 알리오를 몇 건만 호출 (기관 목록 1회, 보고서 2건)

import { AlioError, ALIO_ORIGIN, createAlioClient } from "../lib/alio/client.ts";
import { filterChoices, filterInstitutions } from "../lib/alio/filter.ts";
import { ALIO_ITEMS, FETCHABLE_ITEMS, findFetchableItem, isFetchable } from "../lib/alio/items.ts";
import { MAX_FILE_BYTES } from "../lib/limits.ts";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};
const code = async (promise) => {
  try {
    await promise;
    return "(오류 없음)";
  } catch (e) {
    return e instanceof AlioError ? e.code : `다른 오류: ${e}`;
  }
};

const live = process.argv.includes("--live");

if (!live) {
  console.log("== 1. 공시항목 목록");
  {
    check(ALIO_ITEMS.length === 93, "알리오 공시항목표 93행이 모두 들어 있음", `${ALIO_ITEMS.length}행`);
    check(FETCHABLE_ITEMS.length === 57 && FETCHABLE_ITEMS.every(isFetchable), "가져올 수 있는 항목은 '정기 · 보고서' 중 항목 번호가 있는 57개", `${FETCHABLE_ITEMS.length}개`);
    check(ALIO_ITEMS.filter((i) => i.schedule === "정기" && i.kind === "보고서").length === 58, "정기 · 보고서는 58개 (45번은 항목 번호를 못 찾아 가져오기 대상에서 빠짐)");
    check(new Set(FETCHABLE_ITEMS.map((i) => i.formNo)).size === FETCHABLE_ITEMS.length, "항목 번호가 겹치지 않음");
    check(ALIO_ITEMS.filter((i) => i.checklist).map((i) => `${i.no}:${i.checklist}`).join() === "10:임원연봉,11:직원평균보수", "점검 기준(체크리스트)이 있는 항목은 10번·11번뿐");
    check(findFetchableItem("2050")?.name === "임원 연봉" && findFetchableItem("10105") === undefined && findFetchableItem(2050) === undefined, "수시·게시판 항목 번호나 엉뚱한 값은 가져올 수 있는 항목으로 인정하지 않음");
  }

  const LIST = {
    status: "success",
    data: {
      0: { apbaId: "C0847", apbaNa: "(사)남북교류협력지원협회", subFlag: "N", apbaTypeNa: "기타공공기관", jidtDptmNa: "통일부" },
      1: { apbaId: "A1001", apbaNa: "가온공사", subFlag: "N", apbaTypeNa: "공기업(시장형)", jidtDptmNa: "재정경제부" },
      2: { apbaId: "A1002", apbaNa: "가온공사 부설연구소", subFlag: "Y", apbaTypeNa: "기타공공기관", jidtDptmNa: "재정경제부" },
      3: { apbaId: "잘못된코드", apbaNa: "코드 이상 기관", subFlag: "N", apbaTypeNa: "기타공공기관", jidtDptmNa: "통일부" },
      4: { apbaId: "B2001", apbaNa: "나라기금관리단", subFlag: "N", apbaTypeNa: "준정부기관(기금관리형)", jidtDptmNa: "통일부" },
    },
  };
  const pdfBytes = (n = 100) => {
    const b = new Uint8Array(n);
    b.set(new TextEncoder().encode("%PDF-1.7"));
    return b;
  };
  const page = (dn, options = "") => `<script>... disclosureNo:"${dn}", ...</script>${options}`;

  /** 요청을 기록하고 정해 둔 응답을 돌려주는 가짜 fetch */
  function fake(handler) {
    const calls = [];
    const f = async (url, init) => {
      calls.push({ url: String(url), accept: init?.headers?.accept, at: Date.now(), signal: init?.signal });
      return handler(String(url), init);
    };
    f.calls = calls;
    return f;
  }
  const client = (f, o = {}) => createAlioClient({ fetch: f, minIntervalMs: 0, ...o });

  console.log("\n== 2. 기관 목록");
  {
    const f = fake(() => Response.json(LIST));
    const list = await client(f).listInstitutions();
    check(list.map((i) => i.id).join() === "A1001,C0847,B2001".split(",").sort((a, b) => list.findIndex((i) => i.id === a) - list.findIndex((i) => i.id === b)).join(), "부설 기관과 코드가 이상한 항목은 빼고 본부 기관만 남김", list.map((i) => i.name).join(" / "));
    check(list.length === 3 && list[0].name === "(사)남북교류협력지원협회" || list[0].name === "가온공사", "기관명 가나다순으로 정렬");
    check(list.find((i) => i.id === "C0847")?.type === "기타공공기관" && list.find((i) => i.id === "C0847")?.ministry === "통일부", "기관 유형과 주무 부처가 들어감");
    check(f.calls.length === 1 && f.calls[0].url === `${ALIO_ORIGIN}/organ/findApbaList.json`, "알리오 주소 한 곳만 부름", f.calls[0].url);
    check(await code(client(fake(() => Response.json({ status: "error", data: null }))).listInstitutions()) === "bad-response", "알리오가 오류를 알리면 bad-response");
    check(await code(client(fake(() => new Response("<html>", { status: 200 }))).listInstitutions()) === "bad-response", "JSON이 아니면 bad-response");
    check(await code(client(fake(() => Response.json({ status: "success", data: {} }))).listInstitutions()) === "bad-response", "목록이 비어 있으면 bad-response");
  }

  console.log("\n== 3. 공시번호 찾기");
  {
    const f = fake(() => new Response(page("2026041303148851", '<option selected="selected">2026년1분기</option>')));
    const d = await client(f).findDisclosure("C0847", "2050");
    check(d?.disclosureNo === "2026041303148851" && d.period === "2026년 1분기", "공시번호와 분기를 읽음 (띄어쓰기를 맞춤)", JSON.stringify(d));
    check(f.calls[0].url === `${ALIO_ORIGIN}/item/itemReportTerm.do?apbaId=C0847&reportFormRootNo=2050&disclosureNo=`, "알리오 항목 화면 주소로 부름", f.calls[0].url);
    const spaced = await client(fake(() => new Response(page("2026071303148851", "<option>2026년 2분기</option>")))).findDisclosure("C0847", "2020");
    check(spaced?.period === "2026년 2분기", "'2026년 2분기'처럼 띄어 쓴 표기도 읽음");
    const noPeriod = await client(fake(() => new Response(page("2026071303148851")))).findDisclosure("C0847", "2020");
    check(noPeriod?.disclosureNo && noPeriod.period === null, "분기를 못 읽어도 공시번호는 돌려주고 분기는 null");
    const none = await client(fake(() => new Response(page("")))).findDisclosure("C0847", "2130");
    check(none === null, "공시번호가 비어 있으면 '보고서 없음'(null)이며 오류가 아님");
    check(await code(client(fake(() => new Response("<html>다른 화면</html>"))).findDisclosure("C0847", "2050")) === "bad-response", "공시번호 표식이 아예 없으면 화면이 바뀐 것으로 보고 bad-response");
  }

  console.log("\n== 4. 입력 검사: 이상한 값은 알리오를 부르지 않고 거절");
  {
    const f = fake(() => new Response(page("2026041303148851")));
    const c = client(f);
    check(await code(c.findDisclosure("../etc", "2050")) === "invalid-input", "기관 코드가 이상하면 거절");
    check(await code(c.findDisclosure("c0847", "2050")) === "invalid-input", "소문자 기관 코드도 거절");
    check(await code(c.findDisclosure("C0847", "10105")) === "invalid-input", "수시 보고서 항목 번호는 거절 (가져오는 방법을 확인하지 못함)");
    check(await code(c.findDisclosure("C0847", "B1010")) === "invalid-input", "게시판 항목 번호는 거절");
    check(await code(c.findDisclosure("C0847", "2050&x=1")) === "invalid-input", "항목 번호에 주소 조각을 끼워 넣어도 거절");
    check(await code(c.downloadReport("abc")) === "invalid-input", "숫자가 아닌 공시번호는 거절");
    check(await code(c.downloadReport("2026041303148851/../../x")) === "invalid-input", "경로를 끼워 넣은 공시번호는 거절");
    check(f.calls.length === 0, "거절한 요청은 알리오를 한 번도 부르지 않음");
  }

  console.log("\n== 5. 보고서 PDF 받기");
  {
    const f = fake(() => new Response(pdfBytes(5000), { headers: { "content-type": "application/pdf" } }));
    const bytes = await client(f).downloadReport("2026041303148851");
    check(bytes.length === 5000 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-", "정상 PDF를 받음");
    check(f.calls[0].url === `${ALIO_ORIGIN}/download/pdf.json?disclosureNo=2026041303148851`, "알리오 다운로드 주소로 부름");
    check(await code(client(fake(() => new Response("<html>", { headers: { "content-type": "text/html" } }))).downloadReport("2026041303148851")) === "bad-response", "PDF가 아닌 응답은 bad-response");
    check(await code(client(fake(() => new Response("가짜", { headers: { "content-type": "application/pdf" } }))).downloadReport("2026041303148851")) === "bad-response", "내용이 PDF가 아니면 bad-response");
    check(await code(client(fake(() => new Response(new Uint8Array(0), { headers: { "content-type": "application/pdf" } }))).downloadReport("2026041303148851")) === "bad-response", "빈 응답은 bad-response");
    check(await code(client(fake(() => new Response(pdfBytes(10), { headers: { "content-type": "application/pdf", "content-length": String(MAX_FILE_BYTES + 1) } }))).downloadReport("2026041303148851")) === "too-large", "크기를 미리 알리면 4MB 초과는 본문을 읽기 전에 too-large");
    check(await code(client(fake(() => new Response(pdfBytes(MAX_FILE_BYTES + 1), { headers: { "content-type": "application/pdf" } }))).downloadReport("2026041303148851")) === "too-large", "본문이 4MB를 넘으면 too-large");
    check((await client(fake(() => new Response(pdfBytes(MAX_FILE_BYTES), { headers: { "content-type": "application/pdf" } }))).downloadReport("2026041303148851")).length === MAX_FILE_BYTES, "정확히 4MB는 받음");
  }

  console.log("\n== 6. 알리오가 아닌 곳으로 가지 않음, 장애 처리");
  {
    const redirected = fake(() => {
      const r = new Response(pdfBytes(), { headers: { "content-type": "application/pdf" } });
      Object.defineProperty(r, "url", { value: "https://evil.example.com/x.pdf" });
      return r;
    });
    check(await code(client(redirected).downloadReport("2026041303148851")) === "bad-response", "다른 주소로 넘겨진 응답은 믿지 않음");
    check(await code(client(fake(() => new Response("x", { status: 503 }))).listInstitutions()) === "bad-response", "알리오가 503을 돌려주면 bad-response");
    check(await code(client(fake(() => { throw new TypeError("fetch failed"); })).listInstitutions()) === "network", "연결 실패는 network");
    check(await code(client(fake(() => { throw new DOMException("시간 초과", "TimeoutError"); })).listInstitutions()) === "timeout", "시간 초과는 timeout");
    const f = fake(() => Response.json(LIST));
    await client(f, { timeoutMs: 1234 }).listInstitutions();
    check(f.calls[0].signal instanceof AbortSignal, "모든 요청에 제한 시간(signal)이 붙음");
    const all = fake(() => new Response(page("2026041303148851")));
    const c = client(all);
    await c.findDisclosure("C0847", "2050");
    await c.listInstitutions().catch(() => {});
    await c.downloadReport("2026041303148851").catch(() => {});
    check(all.calls.every((x) => x.url.startsWith(`${ALIO_ORIGIN}/`)), "모든 요청 주소가 https://www.alio.go.kr/ 로 시작함");
  }

  console.log("\n== 7. 요청 사이 간격");
  {
    const f = fake(() => new Response(page("2026041303148851")));
    const c = createAlioClient({ fetch: f, minIntervalMs: 80 });
    await Promise.all([c.findDisclosure("C0847", "2050"), c.findDisclosure("C0847", "2060"), c.findDisclosure("C0847", "2020")]);
    const gaps = f.calls.slice(1).map((x, i) => x.at - f.calls[i].at);
    check(gaps.length === 2 && gaps.every((g) => g >= 70), "동시에 3건을 요청해도 최소 간격(80ms)을 두고 차례로 보냄", `간격 ${gaps.join(", ")}ms`);
  }

  console.log("\n== 8. 기관 유형·주무 부처로 거르기");
  {
    const list = Object.values(LIST.data).filter((o) => o.subFlag === "N" && /^[A-Z]\d{4}$/.test(o.apbaId)).map((o) => ({ id: o.apbaId, name: o.apbaNa, type: o.apbaTypeNa, ministry: o.jidtDptmNa }));
    check(filterInstitutions(list, {}).length === 3, "조건이 없으면 전부");
    check(filterInstitutions(list, { ministries: ["통일부"] }).map((i) => i.id).join() === "C0847,B2001", "주무 부처로 거름");
    check(filterInstitutions(list, { types: ["공기업(시장형)", "기타공공기관"] }).length === 2, "기관 유형 여러 개는 '또는'");
    check(filterInstitutions(list, { types: ["기타공공기관"], ministries: ["재정경제부"] }).length === 0, "유형과 부처는 '그리고'");
    check(filterInstitutions(list, { query: "남북 교류" }).map((i) => i.id).join() === "C0847", "기관명 검색은 띄어쓰기를 무시");
    const choices = filterChoices(list);
    check(choices.types.length === 3 && choices.ministries.join() === "재정경제부,통일부", "조회 칸에 보일 유형·부처 선택지를 목록에서 뽑음", choices.ministries.join());
  }
} else {
  console.log("== 진짜 알리오 호출 (기관 목록 1회, 보고서 2건)");
  const c = createAlioClient();
  const list = await c.listInstitutions();
  check(list.length >= 300, "본부 기관 목록을 받음", `${list.length}곳`);
  const choices = filterChoices(list);
  console.log(`   기관 유형 ${choices.types.length}종: ${choices.types.join(", ")}`);
  console.log(`   주무 부처 ${choices.ministries.length}곳`);
  const inst = list.find((i) => i.id === "C0847");
  check(inst?.name.includes("남북교류협력지원협회") && inst.ministry === "통일부", "남북교류협력지원협회를 찾고 주무 부처가 통일부", JSON.stringify(inst));
  for (const formNo of ["2050", "2060"]) {
    const d = await c.findDisclosure("C0847", formNo);
    check(d !== null, `항목 ${formNo}의 공시번호를 찾음`, JSON.stringify(d));
    if (d) {
      const pdf = await c.downloadReport(d.disclosureNo);
      check(pdf.length > 1000 && pdf.length < MAX_FILE_BYTES, `항목 ${formNo}의 PDF를 받음`, `${pdf.length}바이트`);
    }
  }
  const none = await c.findDisclosure("C0847", "2130");
  check(none === null, "해당 보고서가 없는 항목(2130)은 null 로 돌려줌 (오류 아님)");
}

console.log(failures === 0 ? "\n모두 통과" : `\n실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
