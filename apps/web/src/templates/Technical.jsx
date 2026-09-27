import css from "./technical.css?raw";
import { TemplateRoot, Cover, SafeLink } from "./shared.jsx";
import { safeUrl, yearRange, visibleSections } from "./utils.js";

const pad = (n) => String(n).padStart(2, "0");

/** 가장 많이 쓰인 태그 n개 */
function topTags(projects, n) {
  const count = new Map();
  for (const p of projects) for (const t of p.tags) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

/** 링크 옆에 보여줄 호스트명 (mailto는 주소) */
function hostOf(url) {
  const href = safeUrl(url);
  if (!href) return "";
  const u = new URL(href);
  return u.protocol === "mailto:" ? u.pathname : u.host;
}

/** @param {{ portfolio: import("../schema/types.js").Portfolio, tokens: import("../schema/types.js").DesignTokens }} props */
export default function Technical({ portfolio, tokens }) {
  const { person, projects } = portfolio;
  const range = yearRange(projects);
  const tags = topTags(projects, 3);
  const numbered = visibleSections(portfolio).filter((s) => s !== "hero");
  const num = (s) => pad(numbered.indexOf(s) + 1);

  const head = (id, title, extra) => (
    <div className="tc-head">
      <h2 id={id}>{title}</h2>
      <span className="tc-code">{extra}</span>
    </div>
  );

  const sections = {
    hero: () => (
      <section key="hero" className="tc-section tc-wrap">
        <div className="tc-grid tc-hero">
          <div className="tc-cell tc-id">
            <p className="tc-code"><span className="tc-mark">포트폴리오</span><span>{range}</span></p>
            <h1 className="pf-hero-title" data-pf-field="name">{person.name}</h1>
            <p className="tc-headline pf-headline" data-pf-field="headline">{person.headline}</p>
          </div>
          <dl className="tc-cell tc-spec">
            <div><dt>프로젝트</dt><dd>{projects.length}개</dd></div>
            {range && <div><dt>기간</dt><dd>{range}</dd></div>}
            {tags.length > 0 && <div><dt>주요 분야</dt><dd>{tags.join(", ")}</dd></div>}
            {person.links.length > 0 && <div><dt>링크</dt><dd>{person.links.map((l) => l.label?.trim() || l.url).join(", ")}</dd></div>}
          </dl>
        </div>
      </section>
    ),
    projects: () => (
      <section key="projects" className="tc-section tc-wrap" aria-labelledby="tc-projects">
        {head("tc-projects", `${num("projects")} 작업`, `${projects.length}건`)}
        <ol className="tc-grid tc-projects">
          {projects.map((p, i) => (
            <li key={p.id}>
              <article className="tc-cell tc-project pf-card" data-pf-field={`project.${i}`}>
                <p className="tc-code"><span className="tc-mark">P-{pad(i + 1)}</span><span>{p.year}</span></p>
                <h3 data-pf-field={`project.${i}.title`}>{p.title}</h3>
                <p data-pf-field={`project.${i}.summary`}>{p.summary}</p>
                <div>
                  <dl className="tc-spec">
                    <div><dt>역할</dt><dd>{p.role}</dd></div>
                    {p.tags.length > 0 && <div><dt>태그</dt><dd>{p.tags.join(", ")}</dd></div>}
                  </dl>
                  <Cover project={p} />
                </div>
              </article>
            </li>
          ))}
        </ol>
      </section>
    ),
    about: () => (
      <section key="about" className="tc-section tc-wrap" aria-labelledby="tc-about">
        {head("tc-about", `${num("about")} 소개`, "")}
        <div className="tc-grid">
          <div className="tc-cell tc-about"><p data-pf-field="bio">{person.bio}</p></div>
        </div>
      </section>
    ),
    contact: () => (
      <section key="contact" className="tc-section tc-wrap" aria-labelledby="tc-contact">
        {head("tc-contact", `${num("contact")} 연락`, `${person.links.length}개`)}
        <div className="tc-grid">
          <dl className="tc-cell tc-spec tc-links pf-links">
            {person.links.map((l, i) => (
              <div key={i} data-pf-field={`links.${i}`}>
                <dt>L-{pad(i + 1)}</dt>
                <dd><SafeLink link={l} /><span className="tc-host">{hostOf(l.url)}</span></dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    ),
  };

  return (
    <TemplateRoot grammar="technical" css={css} tokens={tokens}>
      <header className="tc-top tc-wrap tc-code">
        <span>{person.name}</span>
        <span>{range}</span>
      </header>
      <main>{visibleSections(portfolio).map((s) => sections[s]?.())}</main>
      <footer className="tc-foot tc-wrap tc-code">
        <span>© {person.name}</span>
        <span>{projects.length}개 프로젝트 · {range}</span>
      </footer>
    </TemplateRoot>
  );
}
