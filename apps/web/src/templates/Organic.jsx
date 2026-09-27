import css from "./organic.css?raw";
import { TemplateRoot, Cover, SafeLink } from "./shared.jsx";
import { yearRange, visibleSections } from "./utils.js";

/**
 * 오가닉: 곡선과 자연색, 손으로 만든 듯한 질감. 기울인 세리프 이름, 곡선으로 잘린 작업 이미지,
 * 엇갈려 놓인 작업 목록, 물결 밑줄 링크. 곡선 도형은 장식이라 글자 뒤에 겹치지 않게 따로 둔다(대비 보장).
 * @param {{ portfolio: import("../schema/types.js").Portfolio, tokens: import("../schema/types.js").DesignTokens }} props
 */
export default function Organic({ portfolio, tokens }) {
  const { person, projects } = portfolio;

  const sections = {
    hero: () => (
      <section key="hero" className="og-hero og-wrap">
        <div className="og-hero-text">
          <h1 className="pf-hero-title" data-pf-field="name">{person.name}</h1>
          <p className="og-headline pf-headline" data-pf-field="headline">{person.headline}</p>
        </div>
        <div className="og-art" aria-hidden="true">
          <i className="og-blob og-blob-1" />
          <i className="og-blob og-blob-2" />
          <i className="og-blob og-blob-3" />
        </div>
      </section>
    ),
    projects: () => (
      <section key="projects" className="og-section og-wrap" aria-labelledby="og-projects">
        <h2 id="og-projects" className="og-title">작업</h2>
        <ol className="og-projects">
          {projects.map((p, i) => (
            <li key={p.id}>
              <article className="og-project pf-card" data-pf-field={`project.${i}`}>
                <Cover project={p} className={`og-shape-${i % 3}`} />
                <p className="og-meta">{[p.year, p.role].filter(Boolean).join(" · ")}</p>
                <h3 data-pf-field={`project.${i}.title`}>{p.title}</h3>
                <p data-pf-field={`project.${i}.summary`}>{p.summary}</p>
              </article>
            </li>
          ))}
        </ol>
      </section>
    ),
    about: () => (
      <section key="about" className="og-section og-wrap og-about" aria-labelledby="og-about">
        <h2 id="og-about" className="og-title">소개</h2>
        <p data-pf-field="bio">{person.bio}</p>
      </section>
    ),
    contact: () => (
      <section key="contact" className="og-section og-wrap" aria-labelledby="og-contact">
        <h2 id="og-contact" className="og-title">연락</h2>
        <ul className="og-links pf-links">
          {person.links.map((l, i) => <li key={i} data-pf-field={`links.${i}`}><SafeLink link={l} /></li>)}
        </ul>
      </section>
    ),
  };

  return (
    <TemplateRoot grammar="organic" css={css} tokens={tokens}>
      <main>{visibleSections(portfolio).map((s) => sections[s]?.())}</main>
      <footer className="og-foot og-wrap">© {person.name} {yearRange(projects)}</footer>
    </TemplateRoot>
  );
}
