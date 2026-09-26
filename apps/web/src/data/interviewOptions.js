/**
 * 인터뷰 선택지. DNA에는 id가 아니라 사람이 읽는 문구 그대로 저장한다
 * (나중에 Claude API가 DNA를 읽을 때도 그대로 이해할 수 있도록).
 */

export const PRIMARY_GOALS = ["취업·인턴 지원", "외주·협업 의뢰 받기", "작업 기록 남기기", "입시·대회 제출"];

export const AUDIENCES = ["채용 담당자·면접관", "클라이언트", "같은 분야 동료", "교수·심사위원", "누구나"];

export const CONVERSIONS = ["연락하기", "작업물 자세히 보기", "GitHub 등 외부 링크 방문", "이력서 내려받기"];

/**
 * 기억되고 싶은 인상. 모호한 단어(깔끔한·세련된·전문적인·독특한)도 일부러 넣는다 —
 * 사용자가 실제로 쓰는 말이고, 4단계에서 대조 질문으로 분해한다.
 */
export const TARGET_TRAITS = [
  "차분한", "믿음직한", "따뜻한", "대담한", "재치 있는", "정돈된", "섬세한", "친근한",
  "실험적인", "솔직한", "활기찬", "진지한", "깔끔한", "세련된", "전문적인", "독특한",
];

/** 피하고 싶은 인상 */
export const AVOID_TRAITS = [
  "딱딱한", "유치한", "산만한", "차가운", "밋밋한", "과한", "무거운", "가벼운", "흔한", "어두운",
];

export const NO_AVOID = "딱히 없어요";

export const MAX_TRAITS = 3;

/** 시각 카드 반응 문구 (엔진 값 like/neutral/dislike → 화면 문구) */
export const REACTION_LABEL = { dislike: "별로예요", neutral: "상관없어요", like: "좋아요" };

/**
 * 5단계에서 순서를 정하는 섹션. 첫 화면(hero)은 항상 맨 위라 제외.
 * id는 Portfolio.sections와 같은 값을 쓴다.
 */
export const CONTENT_SECTIONS = [
  { id: "projects", label: "작업", hint: "프로젝트와 결과물" },
  { id: "about", label: "소개", hint: "어떤 사람인지, 무엇을 해 왔는지" },
  { id: "contact", label: "연락", hint: "연락처와 링크" },
];

/** 3안 이름과 한 줄 설명 (화면 표시용, 순서 = 화면 순서) */
export const DIRECTION_KINDS = {
  safe: { label: "익숙한 안", note: "많이 본 구성에 개성을 조금" },
  core: { label: "추천안", note: "지금까지의 답에 가장 가까운 방향" },
  stretch: { label: "한 걸음 더 간 안", note: "조금 더 과감하게, 내용 순서는 그대로" },
};

/** 3안을 고른 뒤 "어디가 마음에 들었나요?" 선택지 */
export const DIRECTION_REASONS = ["색", "글자", "배치", "분위기", "여백·간격"];
