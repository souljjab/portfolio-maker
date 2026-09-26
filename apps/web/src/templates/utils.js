/** 템플릿 공통 순수 함수 */

/** 허용된 프로토콜의 URL만 통과. javascript: 등은 null */
export function safeUrl(url, protocols = ["https:", "http:", "mailto:"]) {
  if (typeof url !== "string" || !url) return null;
  try {
    const u = new URL(url);
    return protocols.includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

/** 프로젝트 연도 범위: "2024–2026" / 한 해면 "2026" / 없으면 "" */
export function yearRange(projects) {
  const years = projects.map((p) => p.year).filter(Boolean).sort();
  if (!years.length) return "";
  return years[0] === years.at(-1) ? years[0] : `${years[0]}–${years.at(-1)}`;
}

/**
 * 실제로 그릴 섹션 순서: 내용이 없는 섹션은 뺀다(편집 중엔 소개글·링크·프로젝트가 비어 있을 수 있음).
 * 첫 화면(hero)은 항상 남긴다. 섹션 번호를 매기는 템플릿도 이 목록 기준으로 센다.
 */
export function visibleSections(portfolio) {
  const has = {
    hero: true,
    projects: portfolio.projects.length > 0,
    about: Boolean(portfolio.person.bio?.trim()),
    contact: portfolio.person.links.length > 0,
  };
  return portfolio.sections.filter((s) => has[s]);
}

// 발행된 사이트 안의 이미지 (서버가 sites/{주소}/img/ 에 내용 해시 이름으로 저장)
const SITE_IMAGE = /^\/img\/[a-f0-9]{64}\.(?:webp|jpg|png|gif)$/;
const DATA_IMAGE = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/**
 * 이미지 src로 쓸 수 있는 주소만 통과: https, base64 이미지 data URL(편집기에서 올린 이미지·내려받은 HTML),
 * 또는 발행된 사이트 안의 /img/<해시>.<확장자>.
 * <img>에서는 스크립트가 실행되지 않지만 svg는 빼 둔다(다른 용도로 옮겨 쓰일 때를 대비).
 */
export function safeImageSrc(url) {
  if (typeof url !== "string" || !url) return null;
  if (url.startsWith("data:")) return DATA_IMAGE.test(url) ? url : null;
  if (url.startsWith("/")) return SITE_IMAGE.test(url) ? url : null;
  return safeUrl(url, ["https:"]);
}
