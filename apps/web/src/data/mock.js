/** 백엔드가 생기기 전까지 쓰는 목업 데이터 */

/** 편집기 테스트용 포트폴리오 콘텐츠 */
export const MOCK_PORTFOLIO = {
  id: "draft-1",
  slug: null,
  person: {
    name: "김서윤",
    headline: "사람들이 매일 쓰는 도구를 만드는 학생 개발자",
    bio: "학교에서 불편했던 것들을 웹으로 해결해 왔습니다.",
    links: [{ label: "GitHub", url: "https://github.com/" }],
  },
  projects: [
    { id: "p1", title: "반 과제 관리 앱", summary: "마감과 제출 현황을 한곳에서 보는 협업 도구", role: "기획·개발", year: "2026", tags: ["웹앱", "협업"], cover: null, coverAlt: "" },
    { id: "p2", title: "접근성 체험 시뮬레이션", summary: "휠체어 이동을 3D로 체험하는 브라우저 시뮬레이션", role: "개발", year: "2026", tags: ["3D", "접근성"], cover: null, coverAlt: "" },
    { id: "p3", title: "ETF 전략 백테스트", summary: "레버리지 ETF 매매 전략을 과거 데이터로 검증", role: "분석", year: "2026", tags: ["Python", "데이터"], cover: null, coverAlt: "" },
  ],
  sections: ["hero", "projects", "about", "contact"],
  grammar: "quiet-editorial",
  template: "quiet-editorial",
  tokens: null,
  status: "draft",
};
