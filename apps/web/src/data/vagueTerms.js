/**
 * 모호한 형용사 사전 — 바로 축으로 바꾸지 않고, 화면에서 보이는 뜻으로 나눠서 묻는다.
 * stems: 자기 설명·고른 인상에서 이 단어를 찾을 때 쓰는 어간
 * options[].effects: 그 뜻을 골랐을 때 축이 향할 값 (0~100)
 * option id는 저장값이므로 바꾸지 않는다(문구는 바꿔도 됨).
 */
export const VAGUE_TERMS = [
  {
    key: "clean", word: "깔끔한", stems: ["깔끔"],
    options: [
      { id: "few-colors", label: "색을 적게 쓰는 것", effects: { visual_complexity: 25, expressiveness: 35 } },
      { id: "less-info", label: "정보가 적고 핵심만 있는 것", effects: { density: 25 } },
      { id: "aligned", label: "줄이 딱 맞게 정렬된 것", effects: { conventionality: 70, visual_complexity: 40 } },
      { id: "spacious", label: "여백이 넉넉한 것", effects: { density: 20 } },
    ],
  },
  {
    key: "simple", word: "심플한", stems: ["심플", "단순"],
    options: [
      { id: "few-elements", label: "화면 요소가 적은 것", effects: { visual_complexity: 20 } },
      { id: "familiar", label: "익숙한 구성", effects: { conventionality: 75 } },
      { id: "plain", label: "장식 없이 담백한 것", effects: { expressiveness: 25 } },
      { id: "still", label: "움직임이 없는 것", effects: { motion_intensity: 10 } },
    ],
  },
  {
    key: "classy", word: "고급스러운·세련된", stems: ["고급", "세련"],
    options: [
      { id: "quiet", label: "여백이 많고 조용한 것", effects: { density: 20, expressiveness: 30 } },
      { id: "elegant-type", label: "글자가 크고 우아한 것", effects: { typography_drama: 75 } },
      { id: "big-images", label: "작품·사진이 크게 보이는 것", effects: { image_dominance: 80 } },
      { id: "restrained", label: "색이 절제되고 단정한 것", effects: { playfulness: 15, visual_complexity: 30 } },
    ],
  },
  {
    key: "hip", word: "힙한", stems: ["힙"],
    options: [
      { id: "bold", label: "과감하고 튀는 표현", effects: { expressiveness: 85 } },
      { id: "unexpected", label: "예상 밖의 구성", effects: { conventionality: 20 } },
      { id: "big-type", label: "크고 대비가 강한 글자", effects: { typography_drama: 85 } },
      { id: "playful", label: "장난스러운 요소", effects: { playfulness: 75 } },
    ],
  },
  {
    key: "mood", word: "감성적인", stems: ["감성"],
    options: [
      { id: "warm-color", label: "따뜻한 색감", effects: { warmth: 80 } },
      { id: "photo-mood", label: "사진·이미지가 만드는 분위기", effects: { image_dominance: 75 } },
      { id: "handmade", label: "손으로 만든 듯한 질감", effects: { warmth: 70, conventionality: 40 } },
      { id: "gentle-motion", label: "잔잔한 움직임", effects: { motion_intensity: 35 } },
    ],
  },
  {
    key: "warm", word: "따뜻한", stems: ["따뜻", "따듯"],
    options: [
      { id: "warm-color", label: "색이 따뜻한 것", effects: { warmth: 85 } },
      { id: "friendly", label: "말투·분위기가 친근한 것", effects: { playfulness: 55, conventionality: 65 } },
      { id: "soft-shapes", label: "둥글고 부드러운 모양", effects: { warmth: 75, visual_complexity: 35 } },
      { id: "people", label: "사람·사진이 보이는 것", effects: { image_dominance: 65 } },
    ],
  },
  {
    key: "pro", word: "전문적인", stems: ["전문"],
    options: [
      { id: "organized", label: "정보가 체계적으로 정리된 것", effects: { density: 65, conventionality: 70 } },
      { id: "data", label: "숫자·데이터가 보이는 것", effects: { density: 75, warmth: 30 } },
      { id: "serious", label: "진지하고 단정한 분위기", effects: { playfulness: 10 } },
      { id: "trust", label: "익숙하고 믿음직한 구성", effects: { conventionality: 80 } },
    ],
  },
  {
    key: "unique", word: "독특한", stems: ["독특", "개성"],
    options: [
      { id: "new-layout", label: "처음 보는 구성", effects: { conventionality: 15 } },
      { id: "motion", label: "움직임이 많은 것", effects: { motion_intensity: 75 } },
      { id: "strong-type", label: "개성이 강한 글자", effects: { typography_drama: 85 } },
      { id: "playful", label: "장난스러운 요소", effects: { playfulness: 75 } },
    ],
  },
];

/** 한 단어당 고를 수 있는 뜻의 최대 개수 */
export const MAX_TERM_OPTIONS = 2;
