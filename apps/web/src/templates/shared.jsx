/**
 * 템플릿 공통 부품. 템플릿은 정적 HTML로도 뽑혀야 하므로
 * 상태·이벤트 핸들러를 쓰지 않는다(props → 마크업만).
 * 사용자 텍스트는 JSX 텍스트로만 넣어 React가 이스케이프하게 한다.
 */
import baseCss from "./base.css?raw";
import { tokensToCssVars } from "./tokensToCss.js";
import { safeUrl, safeImageSrc } from "./utils.js";

/** 템플릿 루트: 토큰을 CSS 변수로 주입하고 공통 + grammar CSS를 붙인다 */
export function TemplateRoot({ grammar, css, tokens, children }) {
  return (
    <div className={`pf pf-${grammar}`} style={tokensToCssVars(tokens)}>
      {/* 개발자가 작성한 정적 CSS만 들어간다. 사용자 입력은 절대 넣지 않는다. */}
      <style dangerouslySetInnerHTML={{ __html: baseCss + css }} />
      {children}
    </div>
  );
}

/** 프로젝트 이미지. cover가 없거나 안전하지 않으면 플레이스홀더 */
export function Cover({ project, ratio, className = "" }) {
  const src = safeImageSrc(project.cover);
  return (
    <figure
      className={`pf-cover ${className}`}
      style={ratio ? { aspectRatio: ratio } : undefined}
      aria-hidden={src ? undefined : true}
    >
      {src && <img src={src} alt={project.coverAlt ?? ""} loading="lazy" />}
    </figure>
  );
}

/** 링크 목록 항목. 안전하지 않은 URL은 링크 없이 텍스트로. 라벨이 비면 주소를 보여준다(빈 링크 방지) */
export function SafeLink({ link, className = "pf-link" }) {
  const href = safeUrl(link.url);
  const text = link.label?.trim() || link.url;
  if (!href) return <span className={className}>{text}</span>;
  return <a className={className} href={href} rel="me noopener">{text}</a>;
}
