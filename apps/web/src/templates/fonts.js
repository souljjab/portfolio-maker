/**
 * 토큰에 쓸 수 있는 폰트 목록. 여기 없는 이름은 기본 서체로 대체한다.
 * (AI가 준 임의 문자열이 CSS로 그대로 들어가지 않게 하기 위한 허용 목록)
 * href: 정적 export 시 <head>에 넣을 스타일시트 주소 (사이트 CSP가 Google Fonts·jsDelivr만 허용).
 * label: 편집기에 보이는 이름. body: 긴 본문에도 쓸 수 있는지 (false면 제목 전용).
 */
const G = (q) => `https://fonts.googleapis.com/css2?family=${q}&display=swap`;
const SANS = '"Pretendard Variable", Pretendard, system-ui, sans-serif';

export const FONTS = {
  "Pretendard": {
    label: "고딕", body: true, stack: SANS,
    href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
  },
  "Noto Serif KR": { label: "명조", body: true, stack: '"Noto Serif KR", "Nanum Myeongjo", serif', href: G("Noto+Serif+KR:wght@400;600;700") },
  "JetBrains Mono": {
    label: "고정폭", body: false,
    stack: '"JetBrains Mono", "Pretendard Variable", Pretendard, ui-monospace, monospace', // 한글 글리프는 Pretendard로
    href: G("JetBrains+Mono:wght@400;500"),
  },
  "IBM Plex Sans KR": { label: "또렷한 고딕", body: true, stack: `"IBM Plex Sans KR", ${SANS}`, href: G("IBM+Plex+Sans+KR:wght@400;500;600;700") },
  "Gowun Dodum": { label: "둥글고 다정한 고딕", body: true, stack: `"Gowun Dodum", ${SANS}`, href: G("Gowun+Dodum") },
  "Gowun Batang": { label: "부드러운 바탕", body: true, stack: '"Gowun Batang", "Noto Serif KR", serif', href: G("Gowun+Batang:wght@400;700") },
  "Nanum Myeongjo": { label: "잡지 같은 명조", body: true, stack: '"Nanum Myeongjo", "Noto Serif KR", serif', href: G("Nanum+Myeongjo:wght@400;700;800") },
  "Hahmlet": { label: "개성 있는 명조", body: false, stack: '"Hahmlet", "Noto Serif KR", serif', href: G("Hahmlet:wght@400;600;800") },
  "Black Han Sans": { label: "묵직한 헤드라인", body: false, stack: `"Black Han Sans", ${SANS}`, href: G("Black+Han+Sans") },
  "Do Hyeon": { label: "레트로 간판", body: false, stack: `"Do Hyeon", ${SANS}`, href: G("Do+Hyeon") },
  "Jua": { label: "말랑한 제목", body: false, stack: `"Jua", ${SANS}`, href: G("Jua") },
  "Nanum Pen Script": { label: "손글씨", body: false, stack: '"Nanum Pen Script", cursive', href: G("Nanum+Pen+Script") },
};

export const DISPLAY_FONTS = Object.keys(FONTS);
export const BODY_FONT_IDS = Object.keys(FONTS).filter((k) => FONTS[k].body);

export function fontStack(name, fallback) {
  return FONTS[name]?.stack ?? fallback;
}
