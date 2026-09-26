import css from "./quiet-editorial.css?raw";
import { TemplateRoot, Cover, SafeLink } from "./shared.jsx";
import { visibleSections } from "./utils.js";

/** 시그니처: 프로젝트마다 다른 이미지 크롭 */
const CROPS = ["3 / 2", "4 / 5", "16 / 10"];

/** @param {{ portfolio: import("../schema/types.js").Portfolio, tokens: import("../schema/types.js").DesignTokens }} props */
export default function QuietEditorial({ portfolio, tokens }) {
  const { person, projects } = portfolio;

  const sections = {
    hero: () => (
      <section key="hero" className="qe-section qe-hero qe-wrap">
        <h1>{person.headline || person.name}</h1>
      </section>
    ),
    projects: () => (
      <section key="projects" className="qe-section qe-wrap" aria-labelledby="qe-projects">
        <h2 id="qe-projects" className="qe-label">작업</h2>
        <ol className="qe-projects">
          {projects.map((p, i) => (
            <li key={p.id}>
              <article className="qe-project">
                <div>
                  <p className="qe-meta"><span>{p.year}</span><span>{p.role}</span></p>
                  <h3>{p.title}</h3>
                  <p>{p.summary}</p>
                  {p.tags.length > 0 && <p className="qe-tags">{p.tags.join(" · ")}</p>}
                </div>
                <Cover project={p} ratio={CROPS[i % CROPS.length]} />
              </article>
            </li>
          ))}
        </ol>
      </section>
    ),
    about: () => (
      <section key="about" className="qe-section qe-about qe-wrap" aria-labelledby="qe-about">
        <h2 id="qe-about" className="qe-label">소개</h2>
        <p>{person.bio}</p>
      </section>
    ),
    contact: () => (
      <section key="contact" className="qe-section qe-wrap" aria-labelledby="qe-contact">
        <h2 id="qe-contact" className="qe-label">연락</h2>
        <ul className="qe-links">
          {person.links.map((l, i) => <li key={i}><SafeLink link={l} /></li>)}
        </ul>
      </section>
    ),
  };

  return (
    <TemplateRoot grammar="quiet-editorial" css={css} tokens={tokens}>
      <header className="qe-top qe-wrap">
        <span className="qe-wordmark">{person.name}</span>
      </header>
      <main>{visibleSections(portfolio).map((s) => sections[s]?.())}</main>
      <footer className="qe-foot qe-wrap">© {person.name}</footer>
    </TemplateRoot>
  );
}
