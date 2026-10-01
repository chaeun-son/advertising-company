export type LibraryCategory = "modern" | "geo" | "korea" | "season" | "nature" | "pop";

export type LibraryItem = {
  id: string;
  title: string;
  category: LibraryCategory;
  tags: string[];
  src: string;
  original: boolean;
};

export type LibraryFolder = LibraryCategory | "all" | "mine" | "original";

export const LIBRARY_FOLDERS: { id: LibraryFolder; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "modern", label: "모던" },
  { id: "geo", label: "기하" },
  { id: "korea", label: "한국" },
  { id: "season", label: "계절" },
  { id: "nature", label: "자연" },
  { id: "pop", label: "팝" },
  { id: "original", label: "원본" },
];

export function folderCount(folder: LibraryFolder, uploads = 0) {
  if (folder === "all") return LIBRARY_BACKGROUNDS.length;
  if (folder === "mine") return uploads;
  if (folder === "original") return LIBRARY_BACKGROUNDS.filter((i) => i.original).length;
  return LIBRARY_BACKGROUNDS.filter((i) => i.category === folder).length;
}

export const LIBRARY_BACKGROUNDS: LibraryItem[] = [
  {
    "id": "01_soft_mist",
    "title": "소프트 미스트",
    "category": "modern",
    "tags": [
      "미스트",
      "소프트"
    ],
    "src": "/library/backgrounds/01_soft_mist.svg",
    "original": false
  },
  {
    "id": "02_ice_glow",
    "title": "아이스 글로우",
    "category": "modern",
    "tags": [
      "아이스",
      "글로우"
    ],
    "src": "/library/backgrounds/02_ice_glow.svg",
    "original": false
  },
  {
    "id": "03_mint_facets",
    "title": "민트 크리스털",
    "category": "geo",
    "tags": [
      "민트",
      "크리스털",
      "기하"
    ],
    "src": "/library/backgrounds/03_mint_facets.svg",
    "original": true
  },
  {
    "id": "04_sky_veil",
    "title": "스카이 베일",
    "category": "modern",
    "tags": [
      "하늘",
      "베일"
    ],
    "src": "/library/backgrounds/04_sky_veil.svg",
    "original": false
  },
  {
    "id": "05_glass_hexagons",
    "title": "글라스 헥사곤",
    "category": "geo",
    "tags": [
      "유리",
      "육각",
      "모던"
    ],
    "src": "/library/backgrounds/05_glass_hexagons.svg",
    "original": true
  },
  {
    "id": "06_morning_fog",
    "title": "모닝 포그",
    "category": "modern",
    "tags": [
      "아침",
      "안개"
    ],
    "src": "/library/backgrounds/06_morning_fog.svg",
    "original": false
  },
  {
    "id": "07_cloud_bubbles",
    "title": "클라우드 버블",
    "category": "modern",
    "tags": [
      "구름",
      "버블",
      "소프트"
    ],
    "src": "/library/backgrounds/07_cloud_bubbles.svg",
    "original": true
  },
  {
    "id": "08_silver_mist",
    "title": "실버 미스트",
    "category": "modern",
    "tags": [
      "실버"
    ],
    "src": "/library/backgrounds/08_silver_mist.svg",
    "original": false
  },
  {
    "id": "09_digital_horizon",
    "title": "디지털 지평선",
    "category": "modern",
    "tags": [
      "네온",
      "원근",
      "밤"
    ],
    "src": "/library/backgrounds/09_digital_horizon.svg",
    "original": true
  },
  {
    "id": "10_precision_grid",
    "title": "프리시전 그리드",
    "category": "geo",
    "tags": [
      "격자",
      "도면",
      "정밀"
    ],
    "src": "/library/backgrounds/10_precision_grid.svg",
    "original": true
  },
  {
    "id": "11_cloud_linen",
    "title": "클라우드 린넨",
    "category": "modern",
    "tags": [
      "린넨",
      "구름"
    ],
    "src": "/library/backgrounds/11_cloud_linen.svg",
    "original": false
  },
  {
    "id": "12_lime_flow",
    "title": "라임 플로우",
    "category": "nature",
    "tags": [
      "라임",
      "웨이브",
      "생동"
    ],
    "src": "/library/backgrounds/12_lime_flow.svg",
    "original": true
  },
  {
    "id": "13_prism_frames",
    "title": "프리즘 프레임",
    "category": "pop",
    "tags": [
      "프리즘",
      "프레임",
      "네온"
    ],
    "src": "/library/backgrounds/13_prism_frames.svg",
    "original": true
  },
  {
    "id": "14_paper_fold",
    "title": "라벤더 페이퍼",
    "category": "modern",
    "tags": [
      "접지",
      "라벤더",
      "페이퍼"
    ],
    "src": "/library/backgrounds/14_paper_fold.svg",
    "original": true
  },
  {
    "id": "15_opal_silk",
    "title": "오팔 실크",
    "category": "modern",
    "tags": [
      "오팔",
      "실크"
    ],
    "src": "/library/backgrounds/15_opal_silk.svg",
    "original": false
  },
  {
    "id": "16_peach_silk",
    "title": "피치 실크",
    "category": "modern",
    "tags": [
      "피치",
      "실크",
      "곡선"
    ],
    "src": "/library/backgrounds/16_peach_silk.svg",
    "original": true
  },
  {
    "id": "17_memphis_pop",
    "title": "멤피스 팝",
    "category": "pop",
    "tags": [
      "멤피스",
      "팝",
      "도형"
    ],
    "src": "/library/backgrounds/17_memphis_pop.svg",
    "original": true
  },
  {
    "id": "18_hologram",
    "title": "홀로그램 웨이브",
    "category": "pop",
    "tags": [
      "홀로그램",
      "웨이브"
    ],
    "src": "/library/backgrounds/18_hologram.svg",
    "original": true
  },
  {
    "id": "19_pale_aurora",
    "title": "페일 오로라",
    "category": "pop",
    "tags": [
      "오로라"
    ],
    "src": "/library/backgrounds/19_pale_aurora.svg",
    "original": false
  },
  {
    "id": "20_moonlight_sheer",
    "title": "문라이트 쉬어",
    "category": "modern",
    "tags": [
      "달빛"
    ],
    "src": "/library/backgrounds/20_moonlight_sheer.svg",
    "original": false
  },
  {
    "id": "21_cream_marble",
    "title": "크림 마블",
    "category": "modern",
    "tags": [
      "마블",
      "크림"
    ],
    "src": "/library/backgrounds/21_cream_marble.svg",
    "original": false
  },
  {
    "id": "22_chuseok_moon",
    "title": "추석 보름달",
    "category": "korea",
    "tags": [
      "추석",
      "달",
      "억새"
    ],
    "src": "/library/backgrounds/22_chuseok_moon.svg",
    "original": true
  },
  {
    "id": "23_bojagi",
    "title": "오방색 보자기",
    "category": "korea",
    "tags": [
      "보자기",
      "오방색"
    ],
    "src": "/library/backgrounds/23_bojagi.svg",
    "original": true
  },
  {
    "id": "24_sapphire_grid",
    "title": "사파이어 격자",
    "category": "geo",
    "tags": [
      "사파이어",
      "격자"
    ],
    "src": "/library/backgrounds/24_sapphire_grid.svg",
    "original": false
  },
  {
    "id": "25_lucky_pouches",
    "title": "복주머니",
    "category": "korea",
    "tags": [
      "복주머니",
      "명절"
    ],
    "src": "/library/backgrounds/25_lucky_pouches.svg",
    "original": true
  },
  {
    "id": "26_dancheong",
    "title": "단청의 색",
    "category": "korea",
    "tags": [
      "단청",
      "전통"
    ],
    "src": "/library/backgrounds/26_dancheong.svg",
    "original": true
  },
  {
    "id": "27_aqua_tile",
    "title": "아쿠아 타일",
    "category": "geo",
    "tags": [
      "아쿠아",
      "타일"
    ],
    "src": "/library/backgrounds/27_aqua_tile.svg",
    "original": false
  },
  {
    "id": "28_hex_field",
    "title": "헥스 필드",
    "category": "geo",
    "tags": [
      "육각"
    ],
    "src": "/library/backgrounds/28_hex_field.svg",
    "original": false
  },
  {
    "id": "29_korean_roof",
    "title": "기와 처마",
    "category": "korea",
    "tags": [
      "기와",
      "한옥"
    ],
    "src": "/library/backgrounds/29_korean_roof.svg",
    "original": true
  },
  {
    "id": "30_diamond_cut",
    "title": "다이아 컷",
    "category": "geo",
    "tags": [
      "다이아"
    ],
    "src": "/library/backgrounds/30_diamond_cut.svg",
    "original": false
  },
  {
    "id": "31_triangle_mosaic",
    "title": "삼각 모자이크",
    "category": "geo",
    "tags": [
      "삼각"
    ],
    "src": "/library/backgrounds/31_triangle_mosaic.svg",
    "original": false
  },
  {
    "id": "32_circle_grid",
    "title": "서클 그리드",
    "category": "geo",
    "tags": [
      "원",
      "격자"
    ],
    "src": "/library/backgrounds/32_circle_grid.svg",
    "original": false
  },
  {
    "id": "33_botanical",
    "title": "보태니컬 그린",
    "category": "nature",
    "tags": [
      "잎",
      "보태니컬"
    ],
    "src": "/library/backgrounds/33_botanical.svg",
    "original": true
  },
  {
    "id": "34_summer_sea",
    "title": "여름 바다",
    "category": "season",
    "tags": [
      "바다",
      "여름"
    ],
    "src": "/library/backgrounds/34_summer_sea.svg",
    "original": true
  },
  {
    "id": "35_autumn_maples",
    "title": "가을 단풍",
    "category": "season",
    "tags": [
      "단풍",
      "가을"
    ],
    "src": "/library/backgrounds/35_autumn_maples.svg",
    "original": true
  },
  {
    "id": "36_gold_line",
    "title": "골드 라인",
    "category": "geo",
    "tags": [
      "골드",
      "라인"
    ],
    "src": "/library/backgrounds/36_gold_line.svg",
    "original": false
  },
  {
    "id": "37_blueprint",
    "title": "블루프린트",
    "category": "geo",
    "tags": [
      "도면"
    ],
    "src": "/library/backgrounds/37_blueprint.svg",
    "original": false
  },
  {
    "id": "38_lavender",
    "title": "라벤더 가든",
    "category": "nature",
    "tags": [
      "라벤더",
      "정원"
    ],
    "src": "/library/backgrounds/38_lavender.svg",
    "original": true
  },
  {
    "id": "39_corner_bracket",
    "title": "코너 브라켓",
    "category": "geo",
    "tags": [
      "브라켓"
    ],
    "src": "/library/backgrounds/39_corner_bracket.svg",
    "original": false
  },
  {
    "id": "40_module_block",
    "title": "모듈 블록",
    "category": "geo",
    "tags": [
      "모듈"
    ],
    "src": "/library/backgrounds/40_module_block.svg",
    "original": false
  },
  {
    "id": "41_hanji_grain",
    "title": "한지 결",
    "category": "korea",
    "tags": [
      "한지"
    ],
    "src": "/library/backgrounds/41_hanji_grain.svg",
    "original": false
  },
  {
    "id": "42_celadon",
    "title": "청자 결",
    "category": "korea",
    "tags": [
      "청자"
    ],
    "src": "/library/backgrounds/42_celadon.svg",
    "original": false
  },
  {
    "id": "43_peony",
    "title": "모란 무늬",
    "category": "korea",
    "tags": [
      "모란"
    ],
    "src": "/library/backgrounds/43_peony.svg",
    "original": false
  },
  {
    "id": "44_crane_sky",
    "title": "학의 하늘",
    "category": "korea",
    "tags": [
      "학",
      "하늘"
    ],
    "src": "/library/backgrounds/44_crane_sky.svg",
    "original": false
  },
  {
    "id": "45_lotus_pond",
    "title": "연꽃 연못",
    "category": "korea",
    "tags": [
      "연꽃"
    ],
    "src": "/library/backgrounds/45_lotus_pond.svg",
    "original": false
  },
  {
    "id": "46_obang_nang",
    "title": "오방낭",
    "category": "korea",
    "tags": [
      "오방색"
    ],
    "src": "/library/backgrounds/46_obang_nang.svg",
    "original": false
  },
  {
    "id": "47_seed_bojagi",
    "title": "수박씨 보자기",
    "category": "korea",
    "tags": [
      "보자기"
    ],
    "src": "/library/backgrounds/47_seed_bojagi.svg",
    "original": false
  },
  {
    "id": "48_dancheong_band",
    "title": "단청 띠",
    "category": "korea",
    "tags": [
      "단청"
    ],
    "src": "/library/backgrounds/48_dancheong_band.svg",
    "original": false
  },
  {
    "id": "49_eave_shadow",
    "title": "처마 그림자",
    "category": "korea",
    "tags": [
      "처마"
    ],
    "src": "/library/backgrounds/49_eave_shadow.svg",
    "original": false
  },
  {
    "id": "50_moon_jar",
    "title": "달항아리",
    "category": "korea",
    "tags": [
      "달항아리"
    ],
    "src": "/library/backgrounds/50_moon_jar.svg",
    "original": false
  },
  {
    "id": "51_azalea",
    "title": "봄 진달래",
    "category": "season",
    "tags": [
      "봄",
      "진달래"
    ],
    "src": "/library/backgrounds/51_azalea.svg",
    "original": false
  },
  {
    "id": "52_summer_green",
    "title": "여름 녹음",
    "category": "season",
    "tags": [
      "여름",
      "녹음"
    ],
    "src": "/library/backgrounds/52_summer_green.svg",
    "original": false
  },
  {
    "id": "53_ginkgo",
    "title": "가을 은행",
    "category": "season",
    "tags": [
      "은행"
    ],
    "src": "/library/backgrounds/53_ginkgo.svg",
    "original": false
  },
  {
    "id": "54_snow_bloom",
    "title": "겨울 설화",
    "category": "season",
    "tags": [
      "겨울",
      "눈"
    ],
    "src": "/library/backgrounds/54_snow_bloom.svg",
    "original": false
  },
  {
    "id": "55_plum",
    "title": "입춘 매화",
    "category": "season",
    "tags": [
      "매화"
    ],
    "src": "/library/backgrounds/55_plum.svg",
    "original": false
  },
  {
    "id": "56_iris",
    "title": "단오 창포",
    "category": "season",
    "tags": [
      "창포"
    ],
    "src": "/library/backgrounds/56_iris.svg",
    "original": false
  },
  {
    "id": "57_chuseok_field",
    "title": "추석 들녘",
    "category": "season",
    "tags": [
      "추석"
    ],
    "src": "/library/backgrounds/57_chuseok_field.svg",
    "original": false
  },
  {
    "id": "58_seollal",
    "title": "설날 한복",
    "category": "season",
    "tags": [
      "설날"
    ],
    "src": "/library/backgrounds/58_seollal.svg",
    "original": false
  },
  {
    "id": "59_dongji",
    "title": "동지 팥",
    "category": "season",
    "tags": [
      "동지"
    ],
    "src": "/library/backgrounds/59_dongji.svg",
    "original": false
  },
  {
    "id": "60_lotus_mid",
    "title": "백중 연꽃",
    "category": "season",
    "tags": [
      "연꽃"
    ],
    "src": "/library/backgrounds/60_lotus_mid.svg",
    "original": false
  },
  {
    "id": "61_dew_leaf",
    "title": "이슬 잎",
    "category": "nature",
    "tags": [
      "이슬",
      "잎"
    ],
    "src": "/library/backgrounds/61_dew_leaf.svg",
    "original": false
  },
  {
    "id": "62_bamboo",
    "title": "대나무 숲",
    "category": "nature",
    "tags": [
      "대나무"
    ],
    "src": "/library/backgrounds/62_bamboo.svg",
    "original": false
  },
  {
    "id": "63_sea_foam",
    "title": "바다 거품",
    "category": "nature",
    "tags": [
      "바다"
    ],
    "src": "/library/backgrounds/63_sea_foam.svg",
    "original": false
  },
  {
    "id": "64_mountain_fog",
    "title": "산안개",
    "category": "nature",
    "tags": [
      "산",
      "안개"
    ],
    "src": "/library/backgrounds/64_mountain_fog.svg",
    "original": false
  },
  {
    "id": "65_riverside",
    "title": "강변 갈대",
    "category": "nature",
    "tags": [
      "갈대"
    ],
    "src": "/library/backgrounds/65_riverside.svg",
    "original": false
  },
  {
    "id": "66_wildflower",
    "title": "들꽃 길",
    "category": "nature",
    "tags": [
      "들꽃"
    ],
    "src": "/library/backgrounds/66_wildflower.svg",
    "original": false
  },
  {
    "id": "67_pine",
    "title": "소나무",
    "category": "nature",
    "tags": [
      "소나무"
    ],
    "src": "/library/backgrounds/67_pine.svg",
    "original": false
  },
  {
    "id": "68_ripple",
    "title": "물결",
    "category": "nature",
    "tags": [
      "물결"
    ],
    "src": "/library/backgrounds/68_ripple.svg",
    "original": false
  },
  {
    "id": "69_moss",
    "title": "이끼 정원",
    "category": "nature",
    "tags": [
      "이끼"
    ],
    "src": "/library/backgrounds/69_moss.svg",
    "original": false
  },
  {
    "id": "70_sunset_river",
    "title": "노을 강",
    "category": "nature",
    "tags": [
      "노을"
    ],
    "src": "/library/backgrounds/70_sunset_river.svg",
    "original": false
  },
  {
    "id": "71_neon_frame",
    "title": "네온 프레임",
    "category": "pop",
    "tags": [
      "네온"
    ],
    "src": "/library/backgrounds/71_neon_frame.svg",
    "original": false
  },
  {
    "id": "72_candy_memphis",
    "title": "캔디 멤피스",
    "category": "pop",
    "tags": [
      "캔디"
    ],
    "src": "/library/backgrounds/72_candy_memphis.svg",
    "original": false
  },
  {
    "id": "73_holo_grid",
    "title": "홀로 그리드",
    "category": "pop",
    "tags": [
      "홀로그램"
    ],
    "src": "/library/backgrounds/73_holo_grid.svg",
    "original": false
  },
  {
    "id": "74_prism_beam",
    "title": "프리즘 빔",
    "category": "pop",
    "tags": [
      "프리즘"
    ],
    "src": "/library/backgrounds/74_prism_beam.svg",
    "original": false
  },
  {
    "id": "75_pop_dot",
    "title": "팝 도트",
    "category": "pop",
    "tags": [
      "도트"
    ],
    "src": "/library/backgrounds/75_pop_dot.svg",
    "original": false
  },
  {
    "id": "76_electro_wave",
    "title": "일렉트로 웨이브",
    "category": "pop",
    "tags": [
      "일렉트로"
    ],
    "src": "/library/backgrounds/76_electro_wave.svg",
    "original": false
  },
  {
    "id": "77_sunset_glass",
    "title": "선셋 글래스",
    "category": "pop",
    "tags": [
      "선셋"
    ],
    "src": "/library/backgrounds/77_sunset_glass.svg",
    "original": false
  },
  {
    "id": "78_mint_pop",
    "title": "민트 팝",
    "category": "pop",
    "tags": [
      "민트"
    ],
    "src": "/library/backgrounds/78_mint_pop.svg",
    "original": false
  },
  {
    "id": "79_coral_splash",
    "title": "코랄 스플래시",
    "category": "pop",
    "tags": [
      "코랄"
    ],
    "src": "/library/backgrounds/79_coral_splash.svg",
    "original": false
  },
  {
    "id": "80_violet_beam",
    "title": "바이올렛 빔",
    "category": "pop",
    "tags": [
      "바이올렛"
    ],
    "src": "/library/backgrounds/80_violet_beam.svg",
    "original": false
  },
  {
    "id": "81_terra_silk",
    "title": "테라코타 실크",
    "category": "modern",
    "tags": [
      "테라코타"
    ],
    "src": "/library/backgrounds/81_terra_silk.svg",
    "original": false
  },
  {
    "id": "82_sage_flow",
    "title": "세이지 플로우",
    "category": "nature",
    "tags": [
      "세이지"
    ],
    "src": "/library/backgrounds/82_sage_flow.svg",
    "original": false
  },
  {
    "id": "83_indigo_night",
    "title": "인디고 나이트",
    "category": "modern",
    "tags": [
      "인디고"
    ],
    "src": "/library/backgrounds/83_indigo_night.svg",
    "original": false
  },
  {
    "id": "84_champagne",
    "title": "샴페인 골드",
    "category": "modern",
    "tags": [
      "샴페인"
    ],
    "src": "/library/backgrounds/84_champagne.svg",
    "original": false
  },
  {
    "id": "85_rose_quartz",
    "title": "로즈쿼츠",
    "category": "modern",
    "tags": [
      "로즈쿼츠"
    ],
    "src": "/library/backgrounds/85_rose_quartz.svg",
    "original": false
  },
  {
    "id": "86_emerald_cut",
    "title": "에메랄드 컷",
    "category": "geo",
    "tags": [
      "에메랄드"
    ],
    "src": "/library/backgrounds/86_emerald_cut.svg",
    "original": false
  },
  {
    "id": "87_slate_grid",
    "title": "슬레이트 그리드",
    "category": "geo",
    "tags": [
      "슬레이트"
    ],
    "src": "/library/backgrounds/87_slate_grid.svg",
    "original": false
  },
  {
    "id": "88_ivory_paper",
    "title": "아이보리 페이퍼",
    "category": "modern",
    "tags": [
      "아이보리"
    ],
    "src": "/library/backgrounds/88_ivory_paper.svg",
    "original": false
  },
  {
    "id": "89_coral_reef",
    "title": "코랄 리프",
    "category": "nature",
    "tags": [
      "산호"
    ],
    "src": "/library/backgrounds/89_coral_reef.svg",
    "original": false
  },
  {
    "id": "90_lagoon",
    "title": "라군 블루",
    "category": "nature",
    "tags": [
      "라군"
    ],
    "src": "/library/backgrounds/90_lagoon.svg",
    "original": false
  },
  {
    "id": "91_mustard_memphis",
    "title": "머스타드 멤피스",
    "category": "pop",
    "tags": [
      "머스타드"
    ],
    "src": "/library/backgrounds/91_mustard_memphis.svg",
    "original": false
  },
  {
    "id": "92_pistachio",
    "title": "피스타치오",
    "category": "nature",
    "tags": [
      "피스타치오"
    ],
    "src": "/library/backgrounds/92_pistachio.svg",
    "original": false
  },
  {
    "id": "93_burgundy_silk",
    "title": "버건디 실크",
    "category": "modern",
    "tags": [
      "버건디"
    ],
    "src": "/library/backgrounds/93_burgundy_silk.svg",
    "original": false
  },
  {
    "id": "94_skyline",
    "title": "스카이라인",
    "category": "modern",
    "tags": [
      "스카이라인"
    ],
    "src": "/library/backgrounds/94_skyline.svg",
    "original": false
  },
  {
    "id": "95_fog_city",
    "title": "포그 시티",
    "category": "modern",
    "tags": [
      "포그"
    ],
    "src": "/library/backgrounds/95_fog_city.svg",
    "original": false
  },
  {
    "id": "96_hanok_yard",
    "title": "한옥 마당",
    "category": "korea",
    "tags": [
      "한옥"
    ],
    "src": "/library/backgrounds/96_hanok_yard.svg",
    "original": false
  },
  {
    "id": "97_star_night",
    "title": "별밤",
    "category": "modern",
    "tags": [
      "별"
    ],
    "src": "/library/backgrounds/97_star_night.svg",
    "original": false
  },
  {
    "id": "98_galaxy_wave",
    "title": "은하 웨이브",
    "category": "pop",
    "tags": [
      "은하"
    ],
    "src": "/library/backgrounds/98_galaxy_wave.svg",
    "original": false
  },
  {
    "id": "99_mint_hanji",
    "title": "민트 한지",
    "category": "korea",
    "tags": [
      "민트",
      "한지"
    ],
    "src": "/library/backgrounds/99_mint_hanji.svg",
    "original": false
  },
  {
    "id": "100_nacre",
    "title": "자개 빛",
    "category": "korea",
    "tags": [
      "자개"
    ],
    "src": "/library/backgrounds/100_nacre.svg",
    "original": false
  },
  {
    "id": "101_cool_mint",
    "title": "청량 민트",
    "category": "geo",
    "tags": [
      "민트"
    ],
    "src": "/library/backgrounds/101_cool_mint.svg",
    "original": false
  },
  {
    "id": "102_apricot_silk",
    "title": "살구 비단",
    "category": "modern",
    "tags": [
      "살구"
    ],
    "src": "/library/backgrounds/102_apricot_silk.svg",
    "original": false
  },
  {
    "id": "103_grape_garden",
    "title": "포도 가든",
    "category": "nature",
    "tags": [
      "포도"
    ],
    "src": "/library/backgrounds/103_grape_garden.svg",
    "original": false
  },
  {
    "id": "104_wheat",
    "title": "밀밭",
    "category": "season",
    "tags": [
      "밀밭"
    ],
    "src": "/library/backgrounds/104_wheat.svg",
    "original": false
  },
  {
    "id": "105_frost_grid",
    "title": "서리 격자",
    "category": "geo",
    "tags": [
      "서리"
    ],
    "src": "/library/backgrounds/105_frost_grid.svg",
    "original": false
  },
  {
    "id": "106_dusk_prism",
    "title": "노을 프리즘",
    "category": "pop",
    "tags": [
      "노을",
      "프리즘"
    ],
    "src": "/library/backgrounds/106_dusk_prism.svg",
    "original": false
  },
  {
    "id": "107_jade_bojagi",
    "title": "옥색 보자기",
    "category": "korea",
    "tags": [
      "옥색"
    ],
    "src": "/library/backgrounds/107_jade_bojagi.svg",
    "original": false
  },
  {
    "id": "108_ink_sansu",
    "title": "먹색 산수",
    "category": "korea",
    "tags": [
      "산수",
      "수묵"
    ],
    "src": "/library/backgrounds/108_ink_sansu.svg",
    "original": false
  }
];
