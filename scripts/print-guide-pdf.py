#!/usr/bin/env python3
"""애드스마일 매뉴얼 · 인쇄작업만 A4 PDF로 만든다."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1240, 1754
MARGIN = 72
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
OUT = "/workspace/public/adsmile-print-guide.pdf"

title_f = ImageFont.truetype(FONT, 42, index=0)
h_f = ImageFont.truetype(FONT, 28, index=0)
body_f = ImageFont.truetype(FONT, 22, index=0)
small_f = ImageFont.truetype(FONT, 18, index=0)

SECTIONS = [
    (
        "1. 새 문서",
        "단위 mm · 크기 420×297mm(A3) · 사방 여백 3mm",
        [
            "일러스트레이터 → 새로 만들기",
            "단위는 반드시 mm (인쇄는 px가 아님)",
            "작업 크기 예: 420 × 297 mm (A3. A4 210mm 두 장을 한 면에 앉힌 것)",
            "여백(재단 여분) 사방 3mm. 입력하면 네 면이 한꺼번에 3mm가 붙는다",
            "한 면으로 앉아도 되지만, 원래 작업은 A4 두 장이다",
        ],
    ),
    (
        "2. 대지 팔레트",
        "윈도우 → 대지 · 팔레트 오른쪽 위 삼선(≡)",
        [
            "메뉴 윈도우 → 대지",
            "대지 팔레트가 오른쪽에 뜬다",
            "대지 화면이 뜬 그 팔레트 바로 위 오른쪽 삼선(≡)을 누른다",
            "삼선을 누르면 새 대지 / 대지 옵션이 나온다",
        ],
    ),
    (
        "3. 대지 여러 장 · 재정렬",
        "1쪽은 아래로 · 8~10쪽은 옆으로",
        [
            "여러 쪽이면 새 대지로 장을 만든다 (교육 예: 8장)",
            "대지 아래 정렬 / 재정렬(모든 대지 재정렬)을 누른다",
            "방향: 1쪽은 아래로, 8~10쪽은 옆으로(가로)",
            "대지 안에 420 도큐 + 바깥 빨간 선이 보이면 여분(3mm)이 잡힌 것이다",
        ],
    ),
    (
        "4. 재단 · 여백 (인쇄 기본)",
        "면 색은 재단선보다 밖으로 · 흰 선이 보이면 여분이 부족한 것",
        [
            "모든 인쇄 스탠다드: 기존 도큐보다 좌우 3mm를 빼거나, 1.5mm씩 더 뺀다",
            "면 색·이미지는 재단선보다 밖으로 더 뺀다. 자르는 선에 딱 맞추면 잘렸을 때 흰 선이 보인다",
            "확인 방법: A4 면에 파랑을 칠하고 재단해 본다. 정확히 안 잘리면 흰 자국이 남는다",
            "그래서 색을 재단선 바깥(여백)까지 연장한다",
        ],
    ),
    (
        "5. EPS 저장",
        "넘기는 파일은 EPS · CS5 이하 · 재단 여분을 빼고 저장",
        [
            "도큐는 EPS로 저장해 넘긴다",
            "기존 규칙: CS5 이하로 낮춰 저장",
            "EPS에서 재단 여분(빼는 값)을 빠뜨리지 말 것. 초보가 제일 자주 놓친다",
        ],
    ),
    (
        "6. 서체 · 글꼴 찾기",
        "찾기 → 모두 바꾸기 → Ctrl+A → Ctrl+Shift+O",
        [
            "문자 → 글꼴 찾기",
            "최근 글꼴 상자에서 시스템으로 바꾼 뒤, 쓸 폰트를 고른다",
            "파일에 폰트가 없으면 열 때 노란 경고. 노란 칸 클릭 → 교체",
            "한 글자씩 마우스로 바꾸지 말 것. 찾기 → 바꾸기로 그 서체 위치로 이동한다",
            "제목·본문처럼 종류가 다르면 각각 찾은 뒤, 같은 폰트는 모두 바꾸기",
            "모두 바꾸기를 누르면 그 폰트를 쓴 서체 전체가 바뀐다",
            "확인 후 Ctrl+A → Ctrl+Shift+O (윤곽선 만들기). 깨진 서체는 글꼴 찾기에 안 나타난다",
        ],
    ),
    (
        "7. 서체가 깨졌는지 보는 법",
        "출력해서 비교 · 지정 못 한 서체는 굴림 · 다른 점은 노란 체크",
        [
            "화면만 보면 모른다. 출력용 PDF와 건축용 PDF를 둘 다 출력해서 비교한다",
            "지정하지 않았거나 인식 못 한 서체는 굴림체로 바뀐다. 소재가 통째로 바뀐 것처럼 보인다",
            "다른 점에는 노란색으로 체크해 두고, 고쳐서 다시 보낸다",
        ],
    ),
]


def wrap(draw, text, font, width):
    lines = []
    for raw in text.split("\n"):
        buf = ""
        for ch in raw:
            trial = buf + ch
            if draw.textlength(trial, font=font) > width and buf:
                lines.append(buf)
                buf = ch
            else:
                buf = trial
        lines.append(buf)
    return lines or [""]


pages = []
img = Image.new("RGB", (W, H), "#fffdf8")
draw = ImageDraw.Draw(img)
y = MARGIN
draw.rectangle((0, 0, W, 150), fill="#1b1814")
draw.text((MARGIN, 36), "애드스마일 디자인팀", font=small_f, fill="#f7f1e6")
draw.text((MARGIN, 68), "인쇄작업 매뉴얼", font=title_f, fill="#ffffff")
draw.text((MARGIN, 118), "일러스트 · 2026. 9. 17. 최연수 대표 교육", font=small_f, fill="#f08c00")
y = 190


def new_page():
    global img, draw, y
    pages.append(img)
    img = Image.new("RGB", (W, H), "#fffdf8")
    draw = ImageDraw.Draw(img)
    y = MARGIN
    draw.text((MARGIN, H - 48), "애드스마일 · 직원용 · 인쇄작업", font=small_f, fill="#8a8175")


for title, caption, items in SECTIONS:
    need = 120
    if y + need > H - 90:
        new_page()
    draw.text((MARGIN, y), title, font=h_f, fill="#1b1814")
    y += 40
    draw.text((MARGIN, y), caption, font=small_f, fill="#8a5a12")
    y += 40
    for i, item in enumerate(items, 1):
        lines = wrap(draw, item, body_f, W - MARGIN * 2 - 48)
        if y + 34 * len(lines) > H - 80:
            new_page()
        draw.text((MARGIN, y), f"{i}.", font=body_f, fill="#f08c00")
        for line in lines:
            draw.text((MARGIN + 40, y), line, font=body_f, fill="#1b1814")
            y += 34
        y += 8
    y += 28

draw.text((MARGIN, H - 48), "애드스마일 · 직원용 · 외부에 보내지 마세요", font=small_f, fill="#8a8175")
pages.append(img)
pages[0].save(OUT, save_all=True, append_images=pages[1:], resolution=150)
print(OUT, "pages", len(pages))
