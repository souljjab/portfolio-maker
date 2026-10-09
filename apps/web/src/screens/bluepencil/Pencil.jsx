import { useEffect, useRef, useState } from "react";
import BluePencilEditor from "./BluePencilEditor.jsx";
import { loadDraft, saveDraft, resolveImages, resolveImageRefs, requestPencilAi, saveVersion } from "../../api/index.js";
import { IMAGE_REF, PENCIL_HTML_MAX, pencilBase, isPencilStale } from "../../engine/pencil.js";
import "./pencil.css";

/**
 * 디자인 다듬기 — 블루펜슬 편집기(원본 파일 그대로)를 초안에 연결한다.
 * - 처음 열면 고른 안의 템플릿으로 HTML을 만들고(CSS 변수는 :root로 옮겨 토큰 슬라이더에 잡히게), 이후엔 저장한 HTML을 연다.
 * - 이미지는 초안 참조(img:/upload:)로 저장하고, 편집기에 줄 때만 data URL로 바꾼다.
 * - 바꾼 HTML은 초안의 pencil에 자동 저장 → 동기화·발행이 이 HTML을 쓴다(서버가 다시 거름).
 */
export default function Pencil({ onBack, onPublish }) {
  const [state, setState] = useState(null); // { html, key } | { empty: true }
  const [status, setStatus] = useState("");
  const [stale, setStale] = useState(false);
  const draftRef = useRef(null);
  const urls = useRef({});      // 참조 → data URL (저장할 때 되돌리기용)
  const lastSaved = useRef(null);

  async function open(rebuild = false) {
    const d = await loadDraft();
    if (!d.tokens || !d.template) { setState({ empty: true }); return; }
    let html = !rebuild && d.pencil?.html;
    let draft = d;
    if (!html) {
      html = await fromTemplate(d);
      draft = { ...d, pencil: { html, base: pencilBase(d), updatedAt: Date.now() } };
      await saveDraft(draft);
    }
    draftRef.current = draft;
    lastSaved.current = html;
    setStale(isPencilStale(draft));
    const refs = html.match(IMAGE_REF) ?? [];
    urls.current = await resolveImageRefs(refs);
    setState((s) => ({ html: html.replace(IMAGE_REF, (r) => urls.current[r] ?? r), key: (s?.key ?? 0) + 1 }));
  }
  useEffect(() => { open(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = async ({ html }) => {
    if (!draftRef.current) return;
    let saved = html;
    for (const [ref, url] of Object.entries(urls.current)) if (url) saved = saved.split(url).join(ref);
    if (saved === lastSaved.current) return;
    if (saved.length > PENCIL_HTML_MAX) { setStatus("페이지가 너무 커져서 저장하지 못했어요. 덧붙인 요소를 조금 줄여 주세요."); return; }
    lastSaved.current = saved;
    const d = { ...draftRef.current, pencil: { ...draftRef.current.pencil, html: saved, updatedAt: Date.now() } };
    draftRef.current = d;
    const r = await saveDraft(d);
    setStatus(r.ok ? `저장됨 · ${new Date(r.savedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })}` : "저장하지 못했어요.");
  };

  const rebuild = async () => {
    if (!window.confirm("내용 입력의 최신 내용으로 페이지를 다시 만들까요? 블루펜슬에서 다듬은 것은 버전 기록에 남겨 두고 처음 디자인으로 돌아가요.")) return;
    setStatus("다시 만드는 중…");
    const keep = await saveVersion("블루펜슬 다시 만들기 전", draftRef.current);
    if (!keep.ok) { setStatus(`지금 상태를 먼저 남기지 못해서 다시 만들지 않았어요. (${keep.reason})`); return; }
    await open(true);
    setStatus("내용으로 다시 만들었어요.");
  };

  if (!state) return <p role="status" className="pcl-loading">불러오는 중…</p>;
  if (state.empty) {
    return (
      <div className="pcl-empty">
        <h1>아직 고른 안이 없어요</h1>
        <p>인터뷰에서 세 안 중 하나를 고르면 그 디자인을 다듬을 수 있어요.</p>
        <button type="button" onClick={onBack}>돌아가기</button>
      </div>
    );
  }
  return (
    <div className="pcl">
      <header className="pcl-bar">
        <button type="button" onClick={onBack}>← 내용 입력</button>
        <strong>디자인 다듬기</strong>
        {stale && (
          <span className="pcl-stale">
            내용 입력에서 바뀐 곳이 아직 반영되지 않았어요.
            <button type="button" onClick={rebuild}>내용으로 다시 만들기</button>
          </span>
        )}
        <span className="pcl-status" role="status">{status}</span>
        {!stale && <button type="button" className="pcl-quiet" onClick={rebuild}>내용으로 다시 만들기</button>}
        {onPublish && <button type="button" className="pcl-primary" onClick={onPublish}>발행하기</button>}
      </header>
      <BluePencilEditor key={state.key} initialHtml={state.html} onChange={onChange} aiCall={requestPencilAi} />
    </div>
  );
}

// 템플릿 CSS 변수 → 블루펜슬 편집기의 토큰 이름
const VAR_ALIAS = {
  "--c-bg": "--bg", "--c-surface": "--surface", "--c-text": "--text", "--c-muted": "--muted",
  "--c-accent": "--accent", "--c-on-accent": "--accent-ink", "--f-display": "--font-head", "--f-body": "--font-body",
  "--radius-lg": "--radius", "--space-section": "--space",
};
const PX_VARS = ["--radius", "--space", "--radius-sm"];

/** 고른 안의 템플릿으로 HTML 만들기. 이미지는 참조로 되돌리고, 토큰 CSS 변수는 :root로 옮긴다 */
async function fromTemplate(d) {
  const { renderPortfolioHtml } = await import("../../templates/renderHtml.js");
  const drawn = await resolveImages(d);
  let html = renderPortfolioHtml({ portfolio: drawn, tokens: d.tokens, template: d.template, editable: true });
  drawn.projects.forEach((p, i) => {
    const ref = d.projects[i]?.cover;
    if (p.cover?.startsWith("data:") && ref) html = html.split(p.cover).join(ref);
  });
  // 주요 토큰은 블루펜슬의 이름으로 (분위기 프리셋·대비 점검·라벨이 이 이름을 쓴다)
  for (const [from, to] of Object.entries(VAR_ALIAS)) html = html.replace(new RegExp(`${from}(?![\\w-])`, "g"), to);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.querySelector(".pf[style]");
  if (root) {
    const names = [...root.style].filter((n) => n.startsWith("--"));
    const value = (n) => {
      const v = root.style.getPropertyValue(n).trim();
      const rem = /^(-?[\d.]+)rem$/.exec(v); // 블루펜슬의 모서리·여백 슬라이더는 px 기준
      return PX_VARS.includes(n) && rem ? `${Math.round(parseFloat(rem[1]) * 16)}px` : v;
    };
    const style = doc.createElement("style");
    style.textContent = `:root{${names.map((n) => `${n}:${value(n)}`).join(";")}}`;
    doc.head.append(style);
    names.forEach((n) => root.style.removeProperty(n));
    if (!root.getAttribute("style")?.trim()) root.removeAttribute("style");
  }
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}
