/**
 * 분위기 프리셋 — 색 묶음 + 글꼴 + 모서리를 한 번에 바꾼다(블루펜슬 편집기에서 옮김).
 * 편집기가 적용할 때 대비 게이트(ensureContrast)를 다시 거친다. 글꼴은 templates/fonts.js 허용 목록 안에서만.
 */
export const MOOD_PRESETS = [
  {
    id: "mono", label: "정돈된 모노",
    color: { bg: "#F6F6F4", surface: "#FFFFFF", text: "#17181A", muted: "#5E6166", accent: "#17181A", onAccent: "#FFFFFF" },
    type: { display: "IBM Plex Sans KR", body: "IBM Plex Sans KR" }, radius: 6,
  },
  {
    id: "editorial", label: "따뜻한 에디토리얼",
    color: { bg: "#F3EEE7", surface: "#FBF8F3", text: "#2A231E", muted: "#6B5E54", accent: "#8F3A24", onAccent: "#FFFFFF" },
    type: { display: "Nanum Myeongjo", body: "Gowun Dodum" }, radius: 3,
  },
  {
    id: "night", label: "고요한 밤",
    color: { bg: "#10151F", surface: "#18202E", text: "#E7EBF3", muted: "#9AA4B6", accent: "#8DBBFF", onAccent: "#0F1522" },
    type: { display: "Hahmlet", body: "Pretendard" }, radius: 12,
  },
  {
    id: "pop", label: "말랑한 팝",
    color: { bg: "#FFF5EC", surface: "#FFFFFF", text: "#2B2233", muted: "#6E6277", accent: "#C8361A", onAccent: "#FFFFFF" },
    type: { display: "Jua", body: "Gowun Dodum" }, radius: 22,
  },
];
