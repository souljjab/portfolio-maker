/**
 * 포트폴리오 콘텐츠 검증·정리 (순수 함수). 편집기와 나중의 발행 전 검사가 함께 쓴다.
 * 초안은 불완전해도 저장하지만, 발행은 오류가 없을 때만 가능하게 할 예정.
 */
import { safeUrl } from "../templates/utils.js";
import { MOCK_PORTFOLIO } from "../data/mock.js";

export const LIMITS = {
  name: 30, headline: 60, bio: 600,
  projects: 12, title: 40, summary: 120, role: 30, year: 12, tags: 8, tag: 20,
  links: 8, label: 20, url: 300, alt: 120,
};

/**
 * 입력한 주소를 쓸 수 있는 형태로: 이메일이면 mailto:, 도메인만 있으면 https://를 붙인다.
 * 프로토콜이 이미 있으면 그대로 둔다(허용 여부는 validate에서 safeUrl로 판단).
 */
export function normalizeUrl(input) {
  const v = input.trim();
  if (!v) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(v)) return `mailto:${v}`;
  if (/^(www\.)?[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) return `https://${v}`;
  return v;
}

/** "웹앱, 협업,, 웹앱" → ["웹앱", "협업"] (공백 정리, 중복·빈 값 제거, 개수·길이 제한) */
export function parseTags(text) {
  const out = [];
  for (const t of text.split(/[,，]/).map((x) => x.trim().slice(0, LIMITS.tag))) {
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, LIMITS.tags);
}

/**
 * @param {import("../schema/types.js").Portfolio} portfolio
 * @returns {Record<string, string>}  필드 경로 → 오류 문구 (예: "links.0.url")
 */
export function validatePortfolio(portfolio) {
  const e = {};
  const { person, projects } = portfolio;
  if (!person.name.trim()) e["person.name"] = "이름을 적어 주세요.";
  projects.forEach((p, i) => {
    if (!p.title.trim()) e[`projects.${i}.title`] = "작업 제목을 적어 주세요.";
  });
  person.links.forEach((l, i) => {
    if (!l.label.trim()) e[`links.${i}.label`] = "링크 이름을 적어 주세요. 예: GitHub, 이메일";
    if (!l.url.trim()) e[`links.${i}.url`] = "주소를 적어 주세요.";
    else if (!safeUrl(l.url)) e[`links.${i}.url`] = "https://로 시작하는 주소나 이메일 주소를 넣어 주세요.";
  });
  return e;
}

export function newProject() {
  return {
    id: crypto.randomUUID(), title: "", summary: "", role: "", year: String(new Date().getFullYear()),
    tags: [], cover: null, coverAlt: "",
  };
}

const SAMPLE_TITLES = MOCK_PORTFOLIO.projects.map((p) => p.title);

/**
 * 발행 전 주의사항 (발행을 막지는 않음). 오류는 validatePortfolio가 따로 막는다.
 * @returns {string[]}
 */
export function publishWarnings(portfolio) {
  const w = [];
  const { projects, person } = portfolio;
  const samples = projects.filter((p) => SAMPLE_TITLES.includes(p.title.trim()));
  if (samples.length) w.push(`예시 작업이 ${samples.length}개 남아 있어요: ${samples.map((p) => `‘${p.title}’`).join(", ")}`);
  if (portfolio.template === "gallery" && projects.some((p) => !p.cover)) {
    w.push("갤러리 디자인은 이미지가 주인공인데, 이미지가 없는 작업이 있어요.");
  }
  const noAlt = projects.filter((p) => p.cover && !p.coverAlt?.trim()).length;
  if (noAlt) w.push(`이미지 설명이 비어 있는 작업이 ${noAlt}개 있어요. 꾸밈용 이미지로 처리돼요.`);
  if (!person.links.length) w.push("연락할 방법(링크)이 없어요.");
  if (!person.bio?.trim()) w.push("소개글이 비어 있어서 소개 섹션이 빠져요.");
  return w;
}

/* ── 발행: 주소 규칙과 서버에 보낼 내용 정리 (앱과 서버가 같은 코드를 쓴다) ── */

/** 서비스가 쓰는 이름이라 사용자 주소로 줄 수 없는 것 (docs/decisions.md) */
export const RESERVED_SLUGS = ["www", "app", "api", "admin", "mail", "static", "assets", "help", "support", "status", "blog", "docs", "dev", "test"];
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/** 주소 형식·예약어 문제 (없으면 null). 이미 쓰는지는 서버가 따로 확인 */
export function slugProblem(slug) {
  const s = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (!SLUG_RE.test(s)) return "영문 소문자, 숫자, 하이픈으로 3~30자를 입력하세요. 하이픈으로 시작하거나 끝날 수 없습니다.";
  if (RESERVED_SLUGS.includes(s)) return "서비스에서 쓰는 이름이라 사용할 수 없습니다.";
  return null;
}

const SECTION_IDS = ["projects", "about", "contact"];
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max).trim() : "");
const arr = (v) => (Array.isArray(v) ? v : []);

/**
 * 발행할 내용만 남긴 사본: 알려진 필드만, 글자 수·개수 제한 적용.
 * 서버는 받은 JSON을 믿지 않고 이 함수로 정리한 뒤 validatePortfolio로 검사한다.
 */
export function normalizeForPublish(p) {
  const person = p?.person ?? {};
  const sections = ["hero", ...new Set(arr(p?.sections).filter((s) => SECTION_IDS.includes(s)))];
  for (const s of SECTION_IDS) if (!sections.includes(s)) sections.push(s);
  return {
    person: {
      name: str(person.name, LIMITS.name),
      headline: str(person.headline, LIMITS.headline),
      bio: str(person.bio, LIMITS.bio),
      links: arr(person.links).slice(0, LIMITS.links).map((l) => ({ label: str(l?.label, LIMITS.label), url: str(l?.url, LIMITS.url) })),
    },
    projects: arr(p?.projects).slice(0, LIMITS.projects).map((x, i) => ({
      id: str(x?.id, 64) || `p${i}`,
      title: str(x?.title, LIMITS.title),
      summary: str(x?.summary, LIMITS.summary),
      role: str(x?.role, LIMITS.role),
      year: str(x?.year, LIMITS.year),
      tags: [...new Set(arr(x?.tags).map((t) => str(t, LIMITS.tag)).filter(Boolean))].slice(0, LIMITS.tags),
      cover: typeof x?.cover === "string" ? x.cover.slice(0, 200) : null,
      coverAlt: str(x?.coverAlt, LIMITS.alt),
    })),
    sections,
    grammar: str(p?.grammar, 40),
    template: str(p?.template, 40),
    tokens: p?.tokens ?? null,
  };
}

/** 토큰 모양 확인 (값 자체는 렌더링 때 tokensToCssVars가 검사·대체) */
export function tokensShapeOk(t) {
  return Boolean(t && ["color", "type", "space", "radius", "motion"].every((k) => t[k] && typeof t[k] === "object"));
}
