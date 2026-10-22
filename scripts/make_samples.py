"""시연용 샘플 공시 PDF를 만든다.

기준: docs/sample-data-plan.md (기관 6곳 x 항목 2종 = 파일 12개, 심은 오류 11개)
출력: samples/ (PDF 12개, answer-key.json, exceptions/)

실행:  python scripts/make_samples.py              # 12개 + 예외 3개 + 정답지
       python scripts/make_samples.py --with-big   # 20MB 초과 예외 파일도 만든다 (약 21MB)

필요한 것: pymupdf, fonttools (pip install pymupdf fonttools), Windows 한글 글꼴(맑은 고딕).
fonttools는 글꼴에서 쓴 글자만 남겨 파일 크기를 줄이는 데 쓴다 (없으면 PDF 한 개가 26MB가 된다).
글꼴 위치가 다르면 SAMPLE_FONT, SAMPLE_FONT_BOLD 환경변수로 지정한다.
모든 기관과 수치는 가짜이다. 앱 코드(Next.js)와는 무관한 개발용 도구이다.
"""

import json
import os
import random
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "samples"
EXC = OUT / "exceptions"
FONT = os.environ.get("SAMPLE_FONT", "C:/Windows/Fonts/malgun.ttf")
FONT_BOLD = os.environ.get("SAMPLE_FONT_BOLD", "C:/Windows/Fonts/malgunbd.ttf")

INSTITUTIONS = [
    "한빛에너지공사",
    "푸른물관리공단",
    "미래철도공사",
    "바른주택공사",
    "누리항공공사",
    "가온에너지공단",
]
EXEC, STAFF = "임원연봉", "직원평균보수"

# (기관, 항목 종류) -> [(기준 번호, 유형, 설명, 근거가 될 표/구역 제목)]
ERRORS = {
    ("푸른물관리공단", EXEC): [
        ("R10-3", "필수 기재사항 누락", "급여성 복리후생비 항목이 없음", "임원 보수 현황"),
    ],
    ("미래철도공사", STAFF): [
        ("R11-2", "남녀 구분 누락", "여성 평균보수 없이 남성만 기재", "직원 1인당 평균 보수"),
    ],
    ("바른주택공사", EXEC): [
        ("R10-6", "필수 기재사항 누락", "임원의 성별 평균보수 항목이 없음", "임원 보수 현황"),
    ],
    ("바른주택공사", STAFF): [
        ("R11-4", "필수 기재사항 누락", "신입직원 평균보수 항목이 없음", "직원 1인당 평균 보수"),
    ],
    ("누리항공공사", EXEC): [
        ("R10-4", "필수 기재사항 누락", "경영평가 성과급 항목이 없음", "임원 보수 현황"),
        ("R10-7", "기준 시점 오류", "기준 시점이 '2026년 6월 30일 기준'으로 표시됨", "기준 시점"),
    ],
    ("누리항공공사", STAFF): [
        ("R11-3", "남녀 구분 누락", "평균근속연수가 남녀 구분 없이 합계만 기재", "직원 평균근속연수"),
    ],
    ("가온에너지공단", EXEC): [
        ("R10-1", "필수 기재사항 누락", "기본급(기본연봉) 항목이 없음", "임원 보수 현황"),
        ("R10-5", "필수 기재사항 누락", "기타 성과상여금 항목이 없음", "임원 보수 현황"),
    ],
    ("가온에너지공단", STAFF): [
        ("C-1", "5년 자료 미충족", "최근 5년 중 2개년만 공시하고 사유를 적지 않음", "공시 기간"),
        ("C-2", "갱신 시한 위반", "공시일이 4월말을 넘긴 2026-06-15", "공시일"),
    ],
}

# 정상 문서에 반드시 들어 있는 문구. 오류를 심은 문서에서는 빠진다.
PHRASE = {
    "R10-1": "기본급(기본연봉)",
    "R10-2": "항목별 수당",
    "R10-3": "급여성 복리후생비",
    "R10-4": "경영평가 성과급",
    "R10-5": "기타 성과상여금",
    "R10-6": "임원의 성별 평균보수",
    "R10-7": "결산기준",
    "R11-1": "경영평가 성과급",
    "R11-2": "평균 보수(여성)",
    "R11-3": "평균근속연수(여성)",
    "R11-4": "신입직원 평균보수",
    "C-1": "2021년 ~ 2025년 (5개년)",
    "C-2": "공시일: 2026-04",
}
RULES_BY_ITEM = {
    EXEC: ["R10-1", "R10-2", "R10-3", "R10-4", "R10-5", "R10-6", "R10-7", "C-1", "C-2"],
    STAFF: ["R11-1", "R11-2", "R11-3", "R11-4", "C-1", "C-2"],
}


class Doc:
    def __init__(self):
        self.doc = pymupdf.open()
        self.page = self.doc.new_page(width=595, height=842)
        self.page.insert_font(fontname="kr", fontfile=FONT)
        self.page.insert_font(fontname="krb", fontfile=FONT_BOLD)
        self.y = 60

    def text(self, s, size=10, bold=False, x=40, gap=None):
        self.page.insert_text((x, self.y), s, fontname="krb" if bold else "kr", fontsize=size)
        self.y += gap if gap is not None else size + 8

    def space(self, h):
        self.y += h

    def table(self, headers, rows, widths, x=40, size=8.5, rowh=20):
        def row(cells, fill, bold):
            cx = x
            for c, w in zip(cells, widths):
                rect = pymupdf.Rect(cx, self.y - 14, cx + w, self.y - 14 + rowh)
                self.page.draw_rect(rect, color=(0.6, 0.6, 0.6), fill=fill, width=0.5)
                self.page.insert_text(
                    (cx + 4, self.y), str(c), fontname="krb" if bold else "kr", fontsize=size
                )
                cx += w
            self.y += rowh

        row(headers, (0.93, 0.93, 0.93), True)
        for r in rows:
            row(r, None, False)

    def footer(self):
        self.page.insert_text(
            (40, 810),
            "※ 시연용 가상 자료이며 실제 기관과 무관합니다.",
            fontname="kr",
            fontsize=8,
        )


def money(rng, lo, hi):
    return f"{rng.randint(lo, hi):,}"


def build_exec(inst, fails):
    rng = random.Random(f"{inst}-{EXEC}")
    d = Doc()
    d.text("임원연봉 공시", 18, bold=True, gap=26)
    if inst:
        d.text(f"기관명: {inst}", 11)
    d.text("공시일: 2026-06-15" if "C-2" in fails else "공시일: 2026-04-24")
    d.text(
        "공시 기간: 2024년 ~ 2025년 (2개년)"
        if "C-1" in fails
        else "공시 기간: 2021년 ~ 2025년 (5개년)"
    )
    d.text(
        "기준 시점: 2026년 6월 30일 기준"
        if "R10-7" in fails
        else "기준 시점: 2025년 12월 31일 결산기준 (2026년은 예산기준)",
        gap=26,
    )

    d.text("임원 보수 현황", 12, bold=True, gap=18)
    d.text("(단위: 천원)", 8.5, gap=16)
    cols = [
        ("R10-1", "기본급(기본연봉)", 90, (118000, 152000)),
        ("R10-2", "항목별 수당", 70, (6000, 14000)),
        ("R10-3", "급여성 복리후생비", 105, (3000, 9000)),
        ("R10-4", "경영평가 성과급", 95, (20000, 48000)),
        ("R10-5", "기타 성과상여금", 95, (2000, 9000)),
    ]
    cols = [c for c in cols if c[0] not in fails]
    headers = ["직위"] + [c[1] for c in cols]
    widths = [60] + [c[2] for c in cols]
    rows = [[t] + [money(rng, *c[3]) for c in cols] for t in ("기관장", "상임이사", "상임감사")]
    d.table(headers, rows, widths)
    d.space(28)

    if "R10-6" not in fails:
        d.text("임원의 성별 평균보수", 12, bold=True, gap=18)
        d.text("(단위: 천원)", 8.5, gap=16)
        d.table(
            ["구분", "평균보수"],
            [["남성", money(rng, 130000, 170000)], ["여성", money(rng, 120000, 160000)]],
            [60, 120],
        )
    d.footer()
    return d.doc


def build_staff(inst, fails):
    rng = random.Random(f"{inst}-{STAFF}")
    d = Doc()
    d.text("직원 평균보수 공시", 18, bold=True, gap=26)
    d.text(f"기관명: {inst}", 11)
    d.text("공시일: 2026-06-15" if "C-2" in fails else "공시일: 2026-04-24")
    years = [2024, 2025] if "C-1" in fails else [2021, 2022, 2023, 2024, 2025]
    d.text(
        f"공시 기간: {years[0]}년 ~ {years[-1]}년 ({len(years)}개년)",
    )
    d.text("기준 시점: 2025년 12월 31일 결산기준", gap=26)

    d.text("직원 1인당 보수 현황", 12, bold=True, gap=18)
    d.text("(단위: 천원)", 8.5, gap=16)
    rows = [
        [f"{y}년", money(rng, 41000, 52000), money(rng, 3000, 7000),
         money(rng, 6000, 12000), money(rng, 1000, 4000)]
        for y in years
    ]
    d.table(
        ["연도", "기본급", "항목별 수당", "경영평가 성과급", "기타 성과상여금"],
        rows,
        [60, 90, 90, 100, 100],
    )
    d.space(28)

    d.text("직원 1인당 평균 보수", 12, bold=True, gap=18)
    d.text(f"평균 보수(남성): {money(rng, 61000, 68000)}천원")
    if "R11-2" not in fails:
        d.text(f"평균 보수(여성): {money(rng, 57000, 65000)}천원")
    if "R11-4" not in fails:
        d.text(f"신입직원 평균보수: {money(rng, 33000, 38000)}천원")
    d.space(20)

    d.text("직원 평균근속연수", 12, bold=True, gap=18)
    if "R11-3" in fails:
        d.text(f"평균근속연수(전체): {rng.randint(100, 140) / 10:.1f}년")
    else:
        d.text(f"평균근속연수(남성): {rng.randint(110, 150) / 10:.1f}년")
        d.text(f"평균근속연수(여성): {rng.randint(80, 110) / 10:.1f}년")
    d.footer()
    return d.doc


def save_pdf(doc, path):
    """글꼴을 쓴 글자만 남겨(서브셋) 저장한다."""
    doc.subset_fonts()
    doc.save(path, garbage=4, deflate=True)


def pdf_text(doc):
    return "".join(page.get_text() for page in doc)


def norm(s):
    return "".join(s.split())


def main():
    with_big = "--with-big" in sys.argv
    OUT.mkdir(exist_ok=True)
    EXC.mkdir(exist_ok=True)

    files, problems = [], []
    for inst in INSTITUTIONS:
        for item, builder in ((EXEC, build_exec), (STAFF, build_staff)):
            errs = ERRORS.get((inst, item), [])
            fails = {e[0] for e in errs}
            doc = builder(inst, fails)

            # 자체 검증: 문서에서 빠진 문구가 심은 오류와 정확히 같아야 한다.
            text = norm(pdf_text(doc))
            missing = {r for r in RULES_BY_ITEM[item] if norm(PHRASE[r]) not in text}
            if missing != fails:
                problems.append(f"{inst} {item}: 기대 {sorted(fails)} / 실제 {sorted(missing)}")

            name = f"{inst}_{item}.pdf"
            save_pdf(doc, OUT / name)
            doc.close()
            files.append(
                {
                    "file": name,
                    "institution": inst,
                    "itemType": item,
                    "errors": [
                        {"ruleId": r, "type": t, "description": d_, "evidenceTitle": title}
                        for r, t, d_, title in errs
                    ],
                }
            )

    # 예외 테스트 파일
    src = pymupdf.open(OUT / f"{INSTITUTIONS[0]}_{EXEC}.pdf")
    pix = src[0].get_pixmap(dpi=100)
    scan = pymupdf.open()
    scan.new_page(width=595, height=842).insert_image(pymupdf.Rect(0, 0, 595, 842), pixmap=pix)
    scan.save(EXC / "스캔본_임원연봉.pdf")
    scan_has_text = bool(pdf_text(scan).strip())
    scan.close()
    src.close()

    dup_src = OUT / f"{INSTITUTIONS[5]}_{EXEC}.pdf"
    (EXC / f"{INSTITUTIONS[5]}_{EXEC}(복사).pdf").write_bytes(dup_src.read_bytes())

    nameless = build_exec(None, set())
    nameless_text = pdf_text(nameless)
    nameless_has_name = any(i in nameless_text for i in INSTITUTIONS)
    save_pdf(nameless, EXC / "이름없음_임원연봉.pdf")
    nameless.close()

    if with_big:
        big = pymupdf.open(OUT / f"{INSTITUTIONS[0]}_{EXEC}.pdf")
        big.embfile_add("padding.bin", os.urandom(21 * 1024 * 1024))
        big.save(EXC / "20MB초과_임원연봉.pdf")
        big.close()

    # 정답지
    counts = {i: sum(len(f["errors"]) for f in files if f["institution"] == i) for i in INSTITUTIONS}
    tiers = {}
    for inst, n in counts.items():
        tiers.setdefault(n, []).append(inst)
    ranking = [tiers[n] for n in sorted(tiers, reverse=True)]
    flat = [i for tier in ranking for i in tier]
    key = {
        "basis": "공공기관의 통합공시에 관한 기준 (2025.12.30 개정)",
        "note": "모든 기관과 수치는 가짜이다. docs/sample-data-plan.md 의 정답지와 같다.",
        "totalErrors": sum(counts.values()),
        "errorsByInstitution": counts,
        "expectedRankingTiers": ranking,
        "expectedTop3": flat[:3],
        "files": files,
        "exceptions": [
            {"file": "스캔본_임원연봉.pdf", "expect": "글자를 읽을 수 없음으로 처리 불가"},
            {"file": f"{INSTITUTIONS[5]}_{EXEC}(복사).pdf", "expect": "원본과 둘 다 '중복' 표시, 선택 전 순위에서 제외"},
            {"file": "이름없음_임원연봉.pdf", "expect": "기관 미확인으로 표시"},
            {"file": "(업로드 구성)", "expect": "한빛에너지공사 임원연봉만 올리고 직원평균보수는 올리지 않으면 '업로드되지 않음' 표시"},
            {"file": "20MB초과_임원연봉.pdf (--with-big)", "expect": "그 파일만 처리 불가, 나머지는 계속 점검"},
        ],
    }
    (OUT / "answer-key.json").write_text(
        json.dumps(key, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    # 결과 요약
    print(f"샘플 파일 {len(files)}개, 심은 오류 {key['totalErrors']}개")
    for i in INSTITUTIONS:
        print(f"  {i}: 오류 {counts[i]}개")
    print("기대 순위:", " > ".join("=".join(t) for t in ranking))
    print("기대 상위 3곳:", ", ".join(key["expectedTop3"]))
    print("예외 파일: 스캔본(글자 있음=%s), 중복 복사본, 이름없음(기관명 있음=%s)%s" % (
        scan_has_text, nameless_has_name, ", 20MB 초과" if with_big else ""))
    if scan_has_text or nameless_has_name:
        problems.append("예외 파일 검증 실패 (스캔본에 글자가 있거나 이름없음에 기관명이 있음)")
    if problems:
        print("\n[검증 실패]")
        for p in problems:
            print(" -", p)
        sys.exit(1)
    print("\n자체 검증 통과: 문서에서 빠진 항목이 심은 오류와 모두 일치합니다.")


if __name__ == "__main__":
    main()
