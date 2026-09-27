import css from "./bold-type.css?raw";
import { TemplateRoot, Cover, SafeLink } from "./shared.jsx";
import { yearRange, visibleSections } from "./utils.js";

/**
 * 이름이 한 줄에 폭을 채우도록 글자 크기(cqi)를 추정한다.
 * 한글·한자는 폭 1em, 그 밖의 글자는 약 0.6em, 공백 0.3em으로 계산.
 * 너무 긴 이름은 최소 크기에서 줄바꿈된다.
 */
function nameSize(name) {
  let units = 0;
  for (const ch of name) {
    if (/\s/.test(ch)) units += 0.3;
    else if (/[ᄀ-ᇿ㄰-㆏가-힯一-鿿]/.test(ch)) units += 1;
    else units += 0.6;
  }
  return `${Math.min(36, 102 / Math.max(units, 1)).toFixed(2)}cqi`;
}

const pad = (n) => String(n).padStart(2, "0");

/** @param {{ portfolio: import("../schema/types.js").Portfolio, tokens: import("../schema/types.js").DesignTokens }} props */
export default function BoldType({ portfolio, tokens }) {
  const { person, projects } = portfolio;
  const range = yearRange(projects);

  // 섹션 번호는 노출 순서를 따른다 (hero 제외)
  const numbered = visibleSections(portfolio).filter((s) => s !== "hero");
  const num = (s) => pad(numbered.indexOf(s) + 1);

  const sections = {
    hero: () => (
      <section key="hero" className="bt-hero bt-wrap">
        <h1 className="pf-hero-title" style={{ "--bt-name-size": nameSize(person.name) }}>{person.name}</h1>
        <p className="bt-headline pf-headline">{person.headline}</p>
      </section>
    ),
    projects: () => (
      <section key="projects" className="bt-projects bt-wrap" aria-labelledby="bt-projects">
        <div className="bt-head">
          <span className="bt-mono" aria-hidden="true">{num("projects")}</span>
          <h2 id="bt-projects">작업</h2>
        </div>
        <ol>
          {projects.map((p, i) => (
            <li key={p.id}>
              <article className="bt-project pf-card">
                <span className="bt-index" aria-hidden="true">{pad(i + 1)}</span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.summary}</p>
                </div>
                <div className="bt-side">
                  <Cover project={p} />
                  <div className="bt-meta bt-mono">
                    <span>{p.year}</span>
                    <span>{p.role}</span>
                    {p.tags.length > 0 && <span>{p.tags.join(" / ")}</span>}
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>
      </section>
    ),
    about: () => (
      <section key="about" className="bt-about" aria-labelledby="bt-about">
        <div className="bt-wrap">
          <div className="bt-head">
            <span className="bt-mono" aria-hidden="true">{num("about")}</span>
            <h2 id="bt-about">소개</h2>
          </div>
          <p>{person.bio}</p>
        </div>
      </section>
    ),
    contact: () => (
      <section key="contact" className="bt-contact bt-wrap" aria-labelledby="bt-contact">
        <div className="bt-head">
          <span className="bt-mono" aria-hidden="true">{num("contact")}</span>
          <h2 id="bt-contact">연락</h2>
        </div>
        <ul className="bt-links pf-links">
          {person.links.map((l, i) => <li key={i}><SafeLink link={l} /></li>)}
        </ul>
      </section>
    ),
  };

  return (
    <TemplateRoot grammar="bold-type" css={css} tokens={tokens}>
      <header className="bt-top bt-wrap bt-mono">
        <span>포트폴리오{range && ` ${range}`}</span>
        <span>프로젝트 {projects.length}개</span>
      </header>
      <main>{visibleSections(portfolio).map((s) => sections[s]?.())}</main>
      <footer className="bt-foot bt-wrap bt-mono">
        <span>© {person.name}</span>
        <span>{range}</span>
      </footer>
    </TemplateRoot>
  );
}
