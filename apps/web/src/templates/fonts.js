/**
 * 토큰에 쓸 수 있는 폰트 목록. 여기 없는 이름은 기본 서체로 대체한다.
 * (AI가 준 임의 문자열이 CSS로 그대로 들어가지 않게 하기 위한 허용 목록)
 * href: 정적 export 시 <head>에 넣을 스타일시트 주소.
 */
export const FONTS = {
  "Pretendard": {
    stack: '"Pretendard Variable", Pretendard, system-ui, sans-serif',
    href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
  },
  "Noto Serif KR": {
    stack: '"Noto Serif KR", "Nanum Myeongjo", serif',
    href: "https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&display=swap",
  },
  "JetBrains Mono": {
    stack: '"JetBrains Mono", "Pretendard Variable", Pretendard, ui-monospace, monospace', // 한글 글리프는 Pretendard로
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap",
  },
};

export function fontStack(name, fallback) {
  return FONTS[name]?.stack ?? fallback;
}
