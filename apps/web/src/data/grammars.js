/**
 * Style grammar — 시각 카드이자 생성 템플릿의 뼈대.
 * features: 이 grammar가 각 축에서 어디에 있는지 (0~100). 취향 추론 엔진이 사용.
 * looks: 카드 썸네일이 보여주는 장면 설명 (스크린리더용 대체 텍스트).
 * MVP는 10개로 시작.
 */
export const GRAMMARS = [
  { id: "quiet-editorial", name: "조용한 매거진", blurb: "넓은 여백과 세리프 제목, 글이 주인공", looks: "넓은 여백에 세리프 큰 제목, 아래로 연도와 제목이 적힌 짧은 글 목록",
    features: { visual_complexity: 25, conventionality: 60, warmth: 60, expressiveness: 35, typography_drama: 70, image_dominance: 35, motion_intensity: 15, playfulness: 15, density: 30 } },
  { id: "warm-minimal", name: "따뜻한 미니멀", blurb: "부드러운 색과 적은 요소, 편안한 첫인상", looks: "베이지 배경 가운데 동그란 프로필과 이름, 둥근 버튼 하나와 부드러운 카드 두 장",
    features: { visual_complexity: 20, conventionality: 70, warmth: 80, expressiveness: 25, typography_drama: 35, image_dominance: 45, motion_intensity: 20, playfulness: 35, density: 25 } },
  { id: "swiss", name: "스위스 그리드", blurb: "엄격한 정렬과 굵은 산세리프, 정보가 또렷함", looks: "흰 바탕에 굵은 산세리프 이름과 빨간 사각형, 검은 선 아래 칸이 딱 맞는 세 단 정보",
    features: { visual_complexity: 40, conventionality: 55, warmth: 25, expressiveness: 45, typography_drama: 75, image_dominance: 30, motion_intensity: 15, playfulness: 15, density: 55 } },
  { id: "bold-type", name: "큰 글자", blurb: "화면을 채우는 타이포 하나로 기억에 남기기", looks: "화면 폭을 가득 채운 아주 굵은 이름, 위아래에 작은 고정폭 글자",
    features: { visual_complexity: 35, conventionality: 35, warmth: 45, expressiveness: 85, typography_drama: 95, image_dominance: 20, motion_intensity: 45, playfulness: 50, density: 25 } },
  { id: "bento", name: "벤토 그리드", blurb: "크기가 다른 칸에 여러 역량을 한눈에", looks: "크기와 색이 다른 둥근 칸들이 도시락처럼 모인 격자",
    features: { visual_complexity: 55, conventionality: 65, warmth: 50, expressiveness: 45, typography_drama: 40, image_dominance: 50, motion_intensity: 30, playfulness: 45, density: 70 } },
  { id: "gallery", name: "갤러리", blurb: "작품 한 점씩, 이미지가 화면을 차지", looks: "화면 대부분을 차지하는 큰 풍경 이미지와 아래의 아주 작은 설명",
    features: { visual_complexity: 25, conventionality: 50, warmth: 45, expressiveness: 55, typography_drama: 30, image_dominance: 95, motion_intensity: 35, playfulness: 20, density: 20 } },
  { id: "technical", name: "테크니컬", blurb: "정밀한 선과 데이터, 믿음직한 엔지니어 느낌", looks: "가는 선으로 나뉜 칸마다 번호와 사양 표가 촘촘히 놓인 구성",
    features: { visual_complexity: 50, conventionality: 60, warmth: 20, expressiveness: 30, typography_drama: 40, image_dominance: 25, motion_intensity: 25, playfulness: 10, density: 70 } },
  { id: "retro-web", name: "레트로 웹", blurb: "옛날 인터넷의 재미를 세련되게", looks: "노란 바탕 위 옛날 컴퓨터 창, 파란 밑줄 링크와 방문자 카운터",
    features: { visual_complexity: 70, conventionality: 25, warmth: 60, expressiveness: 75, typography_drama: 55, image_dominance: 45, motion_intensity: 40, playfulness: 85, density: 65 } },
  { id: "organic", name: "오가닉", blurb: "곡선과 자연색, 손으로 만든 듯한 질감", looks: "베이지 바탕의 불규칙한 곡선 도형들과 기울어진 세리프 이름",
    features: { visual_complexity: 45, conventionality: 45, warmth: 85, expressiveness: 55, typography_drama: 45, image_dominance: 60, motion_intensity: 35, playfulness: 45, density: 35 } },
  { id: "experimental", name: "실험적", blurb: "스크롤할 때마다 예상 밖의 장면", looks: "어두운 바탕에 기울어져 화면 밖으로 넘치는 윤곽선 글자와 겹친 주황색 도형",
    features: { visual_complexity: 80, conventionality: 10, warmth: 40, expressiveness: 95, typography_drama: 80, image_dominance: 65, motion_intensity: 90, playfulness: 60, density: 45 } },
];

/** 시각 카드 제시 순서: 연달아 나오는 카드끼리 성격이 크게 다르도록 고정 */
export const CARD_ORDER = [
  "quiet-editorial", "bold-type", "gallery", "technical", "warm-minimal",
  "experimental", "swiss", "organic", "bento", "retro-web",
];

export const grammarById = Object.fromEntries(GRAMMARS.map((g) => [g.id, g]));
