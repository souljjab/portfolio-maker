/**
 * 축의 양 끝을 사람이 읽는 말로. "제가 이해한 방향" 확인 문장에 쓴다.
 * 디자인 용어 대신 화면에서 보이는 모습으로 적고, 조사 문제를 피하려고 "~ 쪽"으로 이어 쓴다.
 */
export const AXIS_PHRASES = {
  visual_complexity: { high: "요소가 많고 풍성한 화면", low: "요소가 적고 단순한 화면" },
  conventionality: { high: "익숙하고 편하게 읽히는 구성", low: "새롭고 예상 밖의 구성" },
  warmth: { high: "따뜻하고 부드러운 색감", low: "차분하고 서늘한 색감" },
  expressiveness: { high: "개성을 과감하게 드러내는 표현", low: "절제되고 담백한 표현" },
  typography_drama: { high: "크고 대비가 강한 글자", low: "잔잔하고 고른 글자" },
  image_dominance: { high: "이미지가 화면을 이끄는 구성", low: "글이 중심인 구성" },
  motion_intensity: { high: "움직임이 눈에 띄는 화면", low: "움직임이 거의 없는 화면" },
  playfulness: { high: "장난스럽고 재미있는 분위기", low: "진지하고 단정한 분위기" },
  density: { high: "정보가 한눈에 촘촘한 구성", low: "여백이 넉넉한 구성" },
};
