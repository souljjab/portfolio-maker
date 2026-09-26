import css from "./gallery.css?raw";
import { TemplateRoot, Cover, SafeLink } from "./shared.jsx";
import { yearRange, visibleSections } from "./utils.js";

const pad = (n) => String(n).padStart(2, "0");

/**
 * 갤러리: 작품 한 점씩, 이미지가 화면을 차지한다. 글은 작게 곁들인다.
 * 이미지가 주인공이라 cover가 없으면 큰 이미지 자리가 그대로 보인다(편집기에서 채우도록).
 * @param {{ portfolio: import("../schema/types.js").Portfolio, tokens: import("../schema/types.js").DesignTokens }} props
 */
export default function Gallery({ portfolio, tokens }) {
  const { person, projects } = portfolio;
  const range = yearRange(projects);

  const sections = {
    hero: () => (
      <section key="hero" className="gl-hero gl-wrap">
        <h1>{person.name}</h1>
        <p className="gl-headline">{person.headline}</p>
      </section>
    ),
    projects: () => (
      <section key="projects" className="gl-wrap" aria-labelledby="gl-projects">
        <h2 id="gl-projects" className="pf-sr">작업</h2>
        <ol className="gl-works">
          {projects.map((p, i) => (
            <li key={p.id}>
              <article className="gl-work">
                <Cover project={p} />
                <div className="gl-cap">
                  <span className="gl-no" aria-hidden="true">{pad(i + 1)}</span>
                  <h3>{p.title}</h3>
                  <span className="gl-meta">{[p.year, p.role].filter(Boolean).join(" · ")}</span>
                </div>
                <p className="gl-summary">{p.summary}</p>
              </article>
            </li>
          ))}
        </ol>
      </section>
    ),
    about: () => (
      <section key="about" className="gl-info gl-wrap" aria-labelledby="gl-about">
        <h2 id="gl-about">소개</h2>
        <p>{person.bio}</p>
      </section>
    ),
    contact: () => (
      <section key="contact" className="gl-info gl-wrap" aria-labelledby="gl-contact">
        <h2 id="gl-contact">연락</h2>
        <ul className="gl-links">
          {person.links.map((l, i) => <li key={i}><SafeLink link={l} /></li>)}
        </ul>
      </section>
    ),
  };

  return (
    <TemplateRoot grammar="gallery" css={css} tokens={tokens}>
      <header className="gl-top gl-wrap">
        <span>작업 {projects.length}점</span>
        <span>{range}</span>
      </header>
      <main>{visibleSections(portfolio).map((s) => sections[s]?.())}</main>
      <footer className="gl-foot gl-wrap">© {person.name}</footer>
    </TemplateRoot>
  );
}
