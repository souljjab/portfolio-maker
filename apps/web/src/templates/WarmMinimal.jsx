import css from "./warm-minimal.css?raw";
import { TemplateRoot, Cover, SafeLink } from "./shared.jsx";
import { safeUrl, visibleSections } from "./utils.js";

/**
 * 따뜻한 미니멀: 가운데 모은 첫 화면, 둥근 카드, 알약 모양 버튼. 요소는 적고 부드럽게.
 * @param {{ portfolio: import("../schema/types.js").Portfolio, tokens: import("../schema/types.js").DesignTokens }} props
 */
export default function WarmMinimal({ portfolio, tokens }) {
  const { person, projects } = portfolio;
  const firstLink = person.links.find((l) => safeUrl(l.url));
  const initial = [...person.name.trim()][0] ?? "";

  const sections = {
    hero: () => (
      <section key="hero" className="wm-hero wm-wrap">
        <span className="wm-avatar" aria-hidden="true">{initial}</span>
        <h1 className="pf-hero-title" data-pf-field="name">{person.name}</h1>
        <p className="wm-headline pf-headline" data-pf-field="headline">{person.headline}</p>
        {firstLink && <SafeLink link={firstLink} className="pf-link wm-btn" />}
      </section>
    ),
    projects: () => (
      <section key="projects" className="wm-section wm-wrap" aria-labelledby="wm-projects">
        <h2 id="wm-projects" className="wm-title">작업</h2>
        <ul className="wm-cards">
          {projects.map((p, i) => (
            <li key={p.id}>
              <article className="wm-card pf-card" data-pf-field={`project.${i}`}>
                <Cover project={p} />
                <div className="wm-card-body">
                  <h3 data-pf-field={`project.${i}.title`}>{p.title}</h3>
                  <p data-pf-field={`project.${i}.summary`}>{p.summary}</p>
                  <p className="wm-meta">{[p.year, p.role].filter(Boolean).join(" · ")}</p>
                  {p.tags.length > 0 && <ul className="wm-tags">{p.tags.map((t) => <li key={t}>{t}</li>)}</ul>}
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>
    ),
    about: () => (
      <section key="about" className="wm-section wm-wrap" aria-labelledby="wm-about">
        <div className="wm-about">
          <h2 id="wm-about" className="wm-title">소개</h2>
          <p data-pf-field="bio">{person.bio}</p>
        </div>
      </section>
    ),
    contact: () => (
      <section key="contact" className="wm-section wm-wrap" aria-labelledby="wm-contact">
        <h2 id="wm-contact" className="wm-title">연락</h2>
        <ul className="wm-links pf-links">
          {person.links.map((l, i) => <li key={i} data-pf-field={`links.${i}`}><SafeLink link={l} className="pf-link wm-pill" /></li>)}
        </ul>
      </section>
    ),
  };

  return (
    <TemplateRoot grammar="warm-minimal" css={css} tokens={tokens}>
      <main>{visibleSections(portfolio).map((s) => sections[s]?.())}</main>
      <footer className="wm-foot wm-wrap">© {person.name}</footer>
    </TemplateRoot>
  );
}
