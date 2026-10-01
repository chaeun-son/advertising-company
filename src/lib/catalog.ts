/** (주)애드스마일 디자인팀 업무 매뉴얼 — 단가·용어·응대·매입처 */

export const COMPANY_SHORT = "애드스마일";
export const COMPANY_LEGAL = "주식회사 애드스마일";
export const STAFF_SEED = [
  { name: "최연수", role: "대표" },
  { name: "손채은", role: "과장" },
  { name: "지재회", role: "대리" },
] as const;

export const PRICE_NOTE =
  "표에 가격이 없을 때, 다시 연락드린다고 한 후 매입단가 확인 후 가격측정";

export type CatalogRow = {
  id: string;
  category: string;
  name: string;
  spec: string;
  minQty: number;
  minQtyLabel: string;
  unit: "개" | "㎡" | "건";
  supply: number;
  vatIncluded?: boolean;
  note?: string;
};

export const CATALOG: CatalogRow[] = [
  {
    id: "card-coat-1",
    category: "명함",
    name: "일반코팅 단면",
    spec: "4도",
    minQty: 500,
    minQtyLabel: "500매",
    unit: "건",
    supply: 20_000,
  },
  {
    id: "card-coat-2",
    category: "명함",
    name: "일반코팅 양면",
    spec: "8도",
    minQty: 500,
    minQtyLabel: "500매",
    unit: "건",
    supply: 20_000,
  },
  {
    id: "card-special-1",
    category: "명함",
    name: "특수지 단면",
    spec: "4도",
    minQty: 200,
    minQtyLabel: "200매",
    unit: "건",
    supply: 20_000,
  },
  {
    id: "card-special-2",
    category: "명함",
    name: "특수지 양면",
    spec: "8도",
    minQty: 200,
    minQtyLabel: "200매",
    unit: "건",
    supply: 25_000,
  },
  {
    id: "card-card-1",
    category: "명함",
    name: "카드 단면",
    spec: "4도",
    minQty: 200,
    minQtyLabel: "200매",
    unit: "건",
    supply: 55_000,
  },
  {
    id: "card-card-2",
    category: "명함",
    name: "카드 양면",
    spec: "8도",
    minQty: 200,
    minQtyLabel: "200매",
    unit: "건",
    supply: 60_000,
  },
  {
    id: "card-rush-1",
    category: "명함",
    name: "긴급명함(반누보) 단면",
    spec: "4도",
    minQty: 200,
    minQtyLabel: "200매",
    unit: "건",
    supply: 30_000,
  },
  {
    id: "card-rush-2",
    category: "명함",
    name: "긴급명함(반누보) 양면",
    spec: "8도",
    minQty: 200,
    minQtyLabel: "200매",
    unit: "건",
    supply: 35_000,
  },
  {
    id: "card-round",
    category: "명함",
    name: "귀도리(라운딩)",
    spec: "후가공",
    minQty: 1,
    minQtyLabel: "1건",
    unit: "건",
    supply: 5_000,
    note: "그 외 후가공은 문의 후 답변",
  },
  {
    id: "ban-min",
    category: "현수막",
    name: "최소 사이즈",
    spec: "500×90 이하",
    minQty: 1,
    minQtyLabel: "1장",
    unit: "개",
    supply: 25_000,
  },
  {
    id: "ban-guerrilla",
    category: "현수막",
    name: "게릴라 현수막",
    spec: "500×90 / 600×90",
    minQty: 1,
    minQtyLabel: "1장",
    unit: "개",
    supply: 25_000,
  },
  {
    id: "ban-m2",
    category: "현수막",
    name: "그 외 사이즈",
    spec: "헤베당(㎡)",
    minQty: 1,
    minQtyLabel: "1장",
    unit: "㎡",
    supply: 10_000,
    note: "9,000원인 경우도 있음. 후가공·시공장소에 따라 가격 변동",
  },
  {
    id: "ban-cube",
    category: "현수막",
    name: "압축큐방",
    spec: "실외 부착",
    minQty: 1,
    minQtyLabel: "1개",
    unit: "개",
    supply: 3_000,
    note: "작은 큐방은 무료. 압축큐방 3,300원(VAT 포함)",
  },
  {
    id: "xb-pet",
    category: "X배너",
    name: "PET 출력",
    spec: "60×180",
    minQty: 1,
    minQtyLabel: "1개",
    unit: "개",
    supply: 35_000,
    note: "거치대 별도",
  },
  {
    id: "xb-ban",
    category: "X배너",
    name: "현수막 출력",
    spec: "60×180",
    minQty: 1,
    minQtyLabel: "1개",
    unit: "개",
    supply: 15_000,
    note: "거치대 별도",
  },
  {
    id: "xb-in",
    category: "X배너",
    name: "거치대 실내",
    spec: "실내용",
    minQty: 1,
    minQtyLabel: "1개",
    unit: "개",
    supply: 20_000,
  },
  {
    id: "xb-out",
    category: "X배너",
    name: "거치대 실외(물통)",
    spec: "실외용",
    minQty: 1,
    minQtyLabel: "1개",
    unit: "개",
    supply: 35_000,
  },
  {
    id: "env-s",
    category: "봉투",
    name: "소봉투 컬러",
    spec: "A4 22×10.5 · 모조 120g",
    minQty: 1000,
    minQtyLabel: "1,000매",
    unit: "건",
    supply: 80_000,
  },
  {
    id: "env-l",
    category: "봉투",
    name: "대봉투 컬러",
    spec: "5절 32.9×24.5 · 모조 120g",
    minQty: 1000,
    minQtyLabel: "1,000매",
    unit: "건",
    supply: 170_000,
    note: "후가공 또는 종이재질에 따라 가격 변동. 흑백은 표에 없음",
  },
  {
    id: "st-sq-g",
    category: "스티커",
    name: "사각 코팅-유광",
    spec: "9×5.5 이하",
    minQty: 1000,
    minQtyLabel: "1,000매",
    unit: "건",
    supply: 20_000,
  },
  {
    id: "st-sq-m",
    category: "스티커",
    name: "사각 코팅-무광",
    spec: "9×5.5 이하",
    minQty: 1000,
    minQtyLabel: "1,000매",
    unit: "건",
    supply: 25_000,
  },
  {
    id: "st-die-g",
    category: "스티커",
    name: "사각 도무송-유광",
    spec: "5.5×2.5 이하",
    minQty: 1000,
    minQtyLabel: "1,000매",
    unit: "건",
    supply: 20_000,
  },
  {
    id: "st-rd-g",
    category: "스티커",
    name: "원형 도무송-유광",
    spec: "6.5×6.5 이하",
    minQty: 1000,
    minQtyLabel: "1,000매",
    unit: "건",
    supply: 25_000,
  },
  {
    id: "st-rd-m",
    category: "스티커",
    name: "원형 도무송-무광",
    spec: "6.5×6.5 이하",
    minQty: 1000,
    minQtyLabel: "1,000매",
    unit: "건",
    supply: 25_000,
    note: "사각 3×3 이하 사이즈는 도무송. 별도 사이즈는 가격 확인 후 전달. 제작기간 확인",
  },
  {
    id: "plaque-thanks",
    category: "감사패",
    name: "감사패",
    spec: "원형 크리스탈 17×18×5",
    minQty: 1,
    minQtyLabel: "1개",
    unit: "개",
    supply: 130_000,
    note: "문구·로고는 장마다 다름. 다른 규격은 매입 확인",
  },
  {
    id: "plaque-memo",
    category: "감사패",
    name: "기념패",
    spec: "원형 크리스탈 17×18×5",
    minQty: 1,
    minQtyLabel: "1개",
    unit: "개",
    supply: 130_000,
    note: "문구·로고는 장마다 다름. 다른 규격은 매입 확인",
  },
];

export const FLYER_MIN = [
  { size: "A3", qty: "2,000매" },
  { size: "A4", qty: "4,000매" },
  { size: "A5", qty: "8,000매" },
  { size: "16절", qty: "8,000매" },
  { size: "8절", qty: "8,000매" },
] as const;

export const PHONE_SCRIPTS = {
  greeting: (name: string) => `감사합니다. 애드스마일 ${name}입니다.`,
  banner: [
    "사이즈",
    "수량",
    "출력 or 시공 (위치 사진·주소)",
    "외부 or 내부",
    "디자인 유무",
    "후가공 (각목 · 각목+끈 · 좌우미싱 · 사방타공 · 사방큐방 · 상단타공 · 바미싱)",
    "언제까지 필요하신가요?",
    "납품방식",
  ],
  xbanner: ["수량", "디자인 유무", "실내 or 실외(물통) 거치대 여부", "언제까지 필요하신가요?", "납품방식"],
  booklet: [
    "사이즈",
    "몇 권",
    "페이지 수",
    "내지 (재질, 단면/양면, 흑백/컬러)",
    "표지 (재질, 흑백/컬러)",
    "언제까지 필요하신가요?",
  ],
  reorder: [
    "언제쯤 제작한 것인지 (연·월 대략)",
    "내용 확인 (명함 성함, 현수막 문구 등)",
    "이전 파일 찾기: 네트워크 f / E / d / ADSMILE 또는 우진 마이페이지",
  ],
  pickup: [
    "방문수령: 방문 가능 일시 (오전/오후라도)",
    "납품: 희망일 → 대표님 당일 납품 가능 여부 확인 후 전달",
    "시공: 대표님께 시공일정 확인 후 담당자에게 전달",
  ],
  ship: [
    "퀵: 받는 주소·성함·연락처, 선불/후불, 대략 퀵비",
    "택배: 받는 주소·성함·연락처, 발송 후 송장번호 안내",
  ],
  tax: ["발행 날짜", "사업자등록증", "계산서 받을 메일 (신규업체)"],
  plaque: [
    "감사패 / 기념패",
    "수량 (문구가 다르면 장 수)",
    "사이즈 (기본 17×18×5)",
    "각인 문구·로고 파일",
    "언제까지 필요하신가요?",
    "납품방식",
  ],
} as const;

export type Term = { name: string; group: string; body: string };

export const TERMS: Term[] = [
  {
    name: "열재단",
    group: "현수막 후가공",
    body: "천 소재는 칼로 자르면 올이 풀림. 뜨거운 인두로 재단. 높이 150cm 이하만.",
  },
  {
    name: "타공(펀칭)",
    group: "현수막 후가공",
    body: "모서리에 금속 링. 찢어지지 않게 삼각라운드를 붙여 내구성 확보.",
  },
  {
    name: "큐방 · 압축큐방",
    group: "현수막 후가공",
    body: "펀칭 후 끈 대신 부착. 실내 유리·타일 = 큐방, 실외 = 압축큐방.",
  },
  {
    name: "사방미싱 · 좌우미싱",
    group: "현수막 후가공",
    body: "올풀림 방지. 끝선을 접어 미싱 (상하좌우 또는 좌우만).",
  },
  {
    name: "각목미싱",
    group: "현수막 후가공",
    body: "좌우에 각목을 넣을 주머니. 실외·타카 고정. 게시대는 각목 없이 봉만 넣음.",
  },
  {
    name: "후렉스(플렉스)",
    group: "원단",
    body: "옥외용, 두께감. 솔벤·라텍스. 조명/비조명. 조명형은 그레이켈 덧방 시 빛 차단.",
  },
  {
    name: "메쉬",
    group: "원단",
    body: "구멍으로 바람을 흘려 찢어짐에 강함. 옥외 배너·현수막. 솔벤·UV.",
  },
  { name: "시트지", group: "시트", body: "단색 PVC, 무광에 가까움. 유리·아크릴·포맥스. 조명/비조명." },
  { name: "켈지", group: "시트", body: "시공 편리, 접착 안정. 간판·유리·차량·펜스·전시장." },
  { name: "그레이켈지", group: "시트", body: "뒷면 어두운 회색. 비침 방지, 덧방·가림용." },
  { name: "에칭시트", group: "시트", body: "불투명, 시선 차단. 사무실·상가·주택. 고급스러운 느낌." },
  { name: "반사시트", group: "시트", body: "빛을 받아 밤에 보임. 표지판·공사장·주차장." },
  { name: "포맥스", group: "소재", body: "압축 PVC. 시트 부착·절단 용이. 표찰·안내판. 1T = 1mm." },
  { name: "폼보드", group: "소재", body: "우드락 양면 종이. 저렴·가볍지만 꺾임." },
  { name: "아크릴", group: "소재", body: "투명 플라스틱. 현판·간판. 배면인쇄 가능." },
  { name: "PET X배너", group: "X배너", body: "플라스틱. 자외선·실내외. 색감 좋음. 표준 60×180." },
  { name: "현수막 X배너", group: "X배너", body: "천. 저렴해 재출력 부담 적음. 색감은 PET보다 떨어짐." },
  { name: "미니배너", group: "X배너", body: "15×30, 18×42 탁상용. PET만. 재단 타공 주의, 납품일 체크." },
  { name: "코팅 스노우", group: "명함 재질", body: "219·250g. 무광 양면코팅. 가장 경제적. 물에 잘 안 젖음." },
  { name: "반누보", group: "명함 재질", body: "209·250g. 직물무늬, 부드러운 재질감. 긴급명함에 사용." },
  { name: "유포지", group: "명함 재질", body: "250g. 내수·내구성, 화질 좋음. 잘 안 찢어짐." },
  { name: "귀도리", group: "인쇄 후가공", body: "모서리를 둥글게. 4mm·6mm 등 원 크기 지정. 코팅·재단 후 최종." },
  { name: "넘버링", group: "인쇄 후가공", body: "일련번호. 시작·끝 번호 또는 시작번호+수량 필요." },
  { name: "형압", group: "인쇄 후가공", body: "음·양각 입체. 명함·책 표지." },
  { name: "박", group: "인쇄 후가공", body: "금박·은박 등 필름을 동판으로 눌러 붙임." },
  { name: "오시", group: "접지", body: "누름선. 150g 이상에서 접힘 터짐을 막음." },
  {
    name: "세네카(책등)",
    group: "제본",
    body: "책꽂이에 꽂았을 때 보이는 면. 100g 이하: 페이지÷2×0.089 / 이상: ÷2×0.12",
  },
  { name: "중철제본", group: "제본", body: "가운데 스테이플러. 신문·얇은 잡지. 두꺼운 용지 불가." },
  { name: "스프링 제본", group: "제본", body: "날장 타공 후 스프링." },
  { name: "무선(풀) 제본", group: "제본", body: "접착제 + 표지. 페이지 많은 책·카탈로그." },
  { name: "떡제본", group: "제본", body: "날장 모아 투명 본드." },
  { name: "양장제본", group: "제본", body: "실로 꿰맴. 고급·보관성. 단가 높고 무거움." },
  { name: "UV인쇄", group: "인쇄 방식", body: "자외선 순간건조. 탈색·습기에 강함." },
  { name: "옵셋인쇄", group: "인쇄 방식", body: "인쇄판→고무롤러→종이. 대량·컬러." },
  { name: "라텍스인쇄", group: "인쇄 방식", body: "수성+라텍스, 열건조. 시트·포스터·벽지 등." },
  { name: "솔벤인쇄", group: "인쇄 방식", body: "실외 플렉스·솔벤시트. 석유계 용제." },
  { name: "수성인쇄", group: "인쇄 방식", body: "실내 현수막·천·켈지·페트. 수성잉크 분사." },
  { name: "전면인쇄", group: "인쇄 방식", body: "앞면에 인쇄. 배면보다 선명, 반무광 UV." },
  { name: "배면인쇄", group: "인쇄 방식", body: "뒷면에 좌우 반전 인쇄. 아크릴 현판 등." },
  { name: "배다(빠다)", group: "기타", body: "바탕색·이미지. 배다를 빼라 = 배경을 재단선 밖으로 늘려라." },
  { name: "별색", group: "기타", body: "CMYK 외 형광·금은분·PANTONE 지정색." },
  { name: "톰보", group: "기타", body: "재단·접지·정합용 + 마크." },
  {
    name: "대지",
    group: "일러스트",
    body: "작업 화면. 윈도우 → 대지. 여러 쪽은 새 대지로 장을 만들고 재정렬한다.",
  },
  {
    name: "재단 여백",
    group: "일러스트",
    body: "인쇄는 사방 3mm. 면 색·이미지는 재단선 밖으로 뺀다. 자르는 선에 맞추면 흰 선이 남는다.",
  },
  {
    name: "글꼴 찾기",
    group: "일러스트",
    body: "문자 → 글꼴 찾기. 한 글자씩 바꾸지 말고 찾기·모두 바꾸기. 없으면 노란 경고 → 교체.",
  },
  {
    name: "윤곽선 만들기",
    group: "일러스트",
    body: "서체를 도형으로 깨기. Ctrl+A 후 Ctrl+Shift+O. 깨진 서체는 글꼴 찾기에 안 나타난다.",
  },
  { name: "갈바", group: "기타", body: "아연+알루미늄 도금 철판. 간판 프레임." },
  { name: "스카시", group: "기타", body: "글자·모양 커팅. 고무는 큰 글자, 아크릴·포맥스는 소형." },
  { name: "채널(찬넬)", group: "기타", body: "입체 문자 간판. 내부에 LED." },
  { name: "리치블랙", group: "기타", body: "K100%에 C 10~30% 추가. 너무 섞으면 뒷묻음." },
  {
    name: "감사패 · 기념패",
    group: "패",
    body: "원형 크리스탈 기본 17×18×5. 애드스마일 단가 130,000원/개. 문구가 다르면 장마다 시안.",
  },
  { name: "단지 배치도", group: "CG", body: "아파트 단지 구성·주변 시설 전체." },
  { name: "동호수 배치도", group: "CG", body: "동·층수 표기." },
  { name: "조감도", group: "CG", body: "위에서 비스듬히 내려다본 건축물. 광역은 주변 일대." },
  { name: "투시도", group: "CG", body: "건물 형태와 분위기." },
  { name: "아이소", group: "CG", body: "내부 공간을 위에서 비스듬히. 동선 파악." },
  { name: "평면도", group: "CG", body: "위에서 본 내부 구조." },
];

export const OUTPUT_RULES = [
  {
    title: "공통",
    items: ["모든 EPS 파일은 CS5 이하로 낮춰 저장해 넘긴다."],
  },
  {
    title: "현수막",
    items: [
      "출력 넘길 때 폭 −2cm (예: 500×90 → 500×88). 세로 폭 150은 제외.",
      "각목미싱: 좌 +10cm, 우 +10cm 늘림 (선 없음).",
      "인간현수막 각목: 좌 +15cm, 우 +15cm (선 없음).",
      "흰 배경은 늘린 부분과 구분이 안 되니 원래 크기에 0.1pt 1cm 선.",
      "이미지 들어간 현수막은 1:1 사이즈.",
      "화면보다 어둡게 출력됨. 인물·이미지는 CMYK 변환 후 밝기 조정.",
    ],
  },
  {
    title: "테이블보 현수막",
    items: ["배경이 흰색·너무 연하면 전체 테두리.", "면 색이 같거나 이어지면 면 사이에 선."],
  },
  {
    title: "포맥스에 붙이는 시트",
    items: [
      "EPS만 오른쪽 +0.5cm, 하단 +0.5cm (AI는 정사이즈). 1T는 붙인 뒤 자르므로 늘리지 않음.",
      "배다도 같이 늘리되 패턴이 커지거나 찌그러지면 안 됨.",
    ],
  },
  {
    title: "글자컷팅 시트",
    items: ["글자는 깨고 선은 깨지 않은 채 EPS.", "겹치는 서체는 패스파인더로 합친 뒤 고정점 추가."],
  },
  {
    title: "X배너",
    items: ["표준 PET 60×180.", "2개 이상이고 배경색이 비슷하면 사이에 1cm 구분선."],
  },
  {
    title: "시안 JPEG",
    items: ["개체가 안 보이면 Ctrl+A 후 Ctrl+F11에서 칠·선 중복 인쇄 해제."],
  },
];

export const PRINT_GUIDE = [
  {
    id: "new-doc",
    title: "1. 새 문서",
    caption: "단위 mm · 크기 420×297mm(A3) · 사방 여백 3mm",
    figure: "new-doc" as const,
    items: [
      "일러스트레이터 → 새로 만들기",
      "단위는 반드시 mm (인쇄는 px가 아님)",
      "작업 크기 예: 420 × 297 mm (A3. A4 210mm 두 장을 한 면에 앉힌 것)",
      "여백(재단 여분) 사방 3mm. 입력하면 네 면이 한꺼번에 3mm가 붙는다",
      "한 면으로 앉아도 되지만, 원래 작업은 A4 두 장이다",
    ],
  },
  {
    id: "palette",
    title: "2. 대지 팔레트",
    caption: "윈도우 → 대지 · 팔레트 오른쪽 위 삼선(≡)",
    figure: "palette" as const,
    items: [
      "메뉴 윈도우 → 대지",
      "대지 팔레트가 오른쪽에 뜬다",
      "대지 화면이 뜬 그 팔레트 바로 위 오른쪽 삼선(≡)을 누른다",
      "삼선을 누르면 새 대지 / 대지 옵션이 나온다",
    ],
  },
  {
    id: "arrange",
    title: "3. 대지 여러 장 · 재정렬",
    caption: "1쪽은 아래로 · 8~10쪽은 옆으로",
    figure: "arrange" as const,
    items: [
      "여러 쪽이면 새 대지로 장을 만든다 (교육 예: 8장)",
      "대지 아래 정렬 / 재정렬(모든 대지 재정렬)을 누른다",
      "방향: 1쪽은 아래로, 8~10쪽은 옆으로(가로)",
      "대지 안에 420 도큐 + 바깥 빨간 선이 보이면 여분(3mm)이 잡힌 것이다",
    ],
  },
  {
    id: "bleed",
    title: "4. 재단 · 여백 (인쇄 기본)",
    caption: "면 색은 재단선보다 밖으로 · 흰 선이 보이면 여분이 부족한 것",
    figure: "bleed" as const,
    items: [
      "모든 인쇄 스탠다드: 기존 도큐보다 좌우 3mm를 빼거나, 1.5mm씩 더 뺀다",
      "면 색·이미지는 재단선보다 밖으로 더 뺀다. 자르는 선에 딱 맞추면 잘렸을 때 흰 선이 보인다",
      "확인 방법: A4 면에 파랑을 칠하고 재단해 본다. 정확히 안 잘리면 흰 자국이 남는다",
      "그래서 색을 재단선 바깥(여백)까지 연장한다",
    ],
  },
  {
    id: "eps",
    title: "5. EPS 저장",
    caption: "넘기는 파일은 EPS · CS5 이하 · 재단 여분을 빼고 저장",
    figure: "eps" as const,
    items: [
      "도큐는 EPS로 저장해 넘긴다",
      "기존 규칙: CS5 이하로 낮춰 저장",
      "EPS에서 재단 여분(빼는 값)을 빠뜨리지 말 것. 초보가 제일 자주 놓친다",
    ],
  },
  {
    id: "font",
    title: "6. 서체 · 글꼴 찾기",
    caption: "찾기 → 모두 바꾸기 → Ctrl+A → Ctrl+Shift+O",
    figure: "font" as const,
    items: [
      "문자 → 글꼴 찾기",
      "최근 글꼴 상자에서 시스템으로 바꾼 뒤, 쓸 폰트를 고른다",
      "파일에 폰트가 없으면 열 때 노란 경고. 노란 칸 클릭 → 교체",
      "한 글자씩 마우스로 바꾸지 말 것. 찾기 → 바꾸기로 그 서체 위치로 이동한다",
      "제목·본문처럼 종류가 다르면 각각 찾은 뒤, 같은 폰트는 모두 바꾸기",
      "모두 바꾸기를 누르면 그 폰트를 쓴 서체 전체가 바뀐다",
      "확인 후 Ctrl+A → Ctrl+Shift+O (윤곽선 만들기). 깨진 서체는 글꼴 찾기에 안 나타난다",
    ],
  },
  {
    id: "proof",
    title: "7. 서체가 깨졌는지 보는 법",
    caption: "출력해서 비교 · 지정 못 한 서체는 굴림 · 다른 점은 노란 체크",
    figure: "proof" as const,
    items: [
      "화면만 보면 모른다. 출력용 PDF와 건축용 PDF를 둘 다 출력해서 비교한다",
      "지정하지 않았거나 인식 못 한 서체는 굴림체로 바뀐다. 소재가 통째로 바뀐 것처럼 보인다",
      "다른 점에는 노란색으로 체크해 두고, 고쳐서 다시 보낸다",
    ],
  },
] as const;

export type PrintGuideFigureId = (typeof PRINT_GUIDE)[number]["figure"];

export const FILE_RULES = [
  {
    title: "폴더명",
    items: ["기관/개인 폴더 안에 「접수날짜+내용+품목」.", "그 안에 원고 폴더. 원고 파일명 「받은날짜+내용」."],
  },
  {
    title: "시안 파일명",
    items: ["시안 잡은 날짜 + 간략한 기관/프로젝트명 + 내용"],
  },
  {
    title: "출력 파일명",
    items: ["최종 시안 파일명 + 사이즈 + 재질 + 수량. 제목만 봐도 출력 가능하게. EPS CS5 이하."],
  },
  {
    title: "의뢰서 파일명",
    items: ["접수날짜+내용+의뢰서. 2가지 이상이면 「접수날짜+내용 외+의뢰서」."],
  },
  {
    title: "이전 파일",
    items: [
      "네트워크 f(~2018) / E(2019~2021.5) / d(2021.6~2021.12) / ADSMILE(2022~)",
      "우진협동조합 마이페이지 → 주문배송조회, 기간을 넉넉히.",
    ],
  },
];

export const VENDORS = [
  {
    name: "미스카시 (미아크릴)",
    phone: "010-6628-1023",
    email: "yck3531023@naver.com",
    use: "포맥스, 아크릴 외",
  },
  { name: "애드다 (알리다)", phone: "063-212-6481", email: "adda6481@naver.com", use: "실사출력, 아크릴 외" },
  { name: "다인안전", phone: "063-226-6455", email: "ksc6455@nate.com", use: "A보드 외" },
  { name: "랩터", phone: "031-475-5673 / 010-3239-5673", email: "wraptor@naver.com", use: "차량 랩핑" },
  { name: "전주칼라", phone: "063-244-1098", email: "kimjcp@chol.com", use: "인쇄물(전단, 리플렛 등)" },
  { name: "청명인쇄", phone: "010-4283-1388", email: "eracerkim@hanmail.net", use: "인쇄물(제본 등)" },
  { name: "해냄디자인", phone: "010-3689-1596", email: "lino330@hanmail.net", use: "인쇄물(제본 등)" },
  { name: "(주)동산기획", phone: "1577-1972", email: "dongsan1902@hanmail.net", use: "게릴라 현수막" },
  { name: "가온시스템", phone: "010-2838-0366", email: "", use: "출력원단 및 기계" },
  { name: "애드코아", phone: "02-2272-7518", email: "https://www.adcore.co.kr/", use: "스크래치 복권" },
  { name: "하우사인", phone: "031-8077-9177", email: "how@howsign.com", use: "이젤, X배너 거치대 등" },
  { name: "코피몰", phone: "032-858-0961", email: "copimall0304@gmail.com", use: "파라솔, 테이블 외" },
  { name: "전북퀵 물류협동조합", phone: "063-287-5882", email: "", use: "퀵" },
] as const;

export const FOLD_TYPES = [
  "2단 접지",
  "3단 접지",
  "4단 접지",
  "N자 접지",
  "3단 대문 접지",
  "병풍 접지",
  "십자 접지",
  "4단 대문 접지",
  "두루마리 접지",
  "DM접지",
] as const;

export const CATEGORIES = ["명함", "현수막", "X배너", "감사패", "봉투", "스티커"] as const;

export const PAYMENTS = ["현금", "세금계산서", "카드결제", "계좌이체"] as const;
export type Payment = (typeof PAYMENTS)[number];
export const DELIVERIES = ["방문수령", "납품", "시공", "퀵", "택배"] as const;

export const BANNER_FINISHING = [
  "각목",
  "각목+끈",
  "좌우미싱",
  "사방타공",
  "사방큐방",
  "상단타공",
  "바미싱",
  "열재단",
] as const;

export const REQUEST_GUIDE = [
  {
    title: "머리",
    items: [
      "대금결제는 VAT 포함 전체 금액.",
      "현금 / 세금계산서 / 카드결제 / 계좌이체. 선결제 시 체크.",
      "담당자는 의뢰서 작성자 본인 이름 (최연수 / 손채은 / 지재회).",
    ],
  },
  {
    title: "프로젝트·일정",
    items: [
      "프로젝트명. 품목이 2가지 이상이면 「내용 외」.",
      "접수 일자는 최초로 접수된 날짜.",
      "납품 일자는 납품·방문수령·시공 날짜 (시간까지).",
    ],
  },
  {
    title: "표",
    items: [
      "업체명(담당자) · 품명 · 연락처.",
      "사이즈는 cm로 표기.",
      "색도: 1도 흑백 / 4도 단면 / 8도 양면.",
      "후가공·수량·기타를 빠짐없이.",
    ],
  },
  {
    title: "메모",
    items: [
      "납품, 방문수령, 시공 하는 것인지 표기.",
      "특이사항 (퀵·택배면 받는 주소·사람).",
      "매입단가·매출단가를 알면 기재. 모르면 「매입단가 확인요망」.",
    ],
  },
  {
    title: "파일명",
    items: [
      "접수날짜+내용+의뢰서",
      "2가지 이상이면 접수날짜+내용 외+의뢰서",
    ],
  },
] as const;

export const WOOJIN_STEPS = [
  "우진협동조합 메인에서 명함 위에 마우스를 올려 옆으로 이동해 재질·크기를 고른다.",
  "주문제목 입력 → 종류/도수 → 재질 → 수량/건수 → 출고일 확인.",
  "1건 = 시안 1종. 예: 1명이 400매 주문하면 400매 1건.",
  "주문저장 → 접수 파일 선택 → OS는 IBM → 주문접수.",
  "마이페이지에서 접수한 제목을 눌러 EPS가 정상인지 확인. EPS는 CS5 이하만 가능.",
  "취소는 접수중일 때만 홈에서 가능. 접수완료면 전화로 취소.",
  "파일 에러가 뜨면 주문내역 하단 「파일재접수」.",
] as const;

export function greetingLine(staffName: string) {
  const name = staffName.trim() || "○○○";
  return PHONE_SCRIPTS.greeting(name);
}

export function fileStamp(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}${d}`;
}

export function suggestFolder(content: string, item: string, date?: Date) {
  const body = content.trim() || "내용";
  return `${fileStamp(date)} ${body} ${item}`.replace(/\s+/g, " ").trim();
}

export function suggestRequestName(content: string, extra = false, date?: Date) {
  const body = content.trim() || "내용";
  return extra ? `${fileStamp(date)} ${body} 외 의뢰서` : `${fileStamp(date)} ${body} 의뢰서`;
}

export function suggestOutputName(
  draftName: string,
  size: string,
  material: string,
  qty: string,
) {
  return `${draftName} ${size} ${material} ${qty}`.replace(/\s+/g, " ").trim();
}

