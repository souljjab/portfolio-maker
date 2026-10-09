import { useEffect, useMemo, useRef, useState } from "react";
import { loadDraft, saveDraft, uploadImage, saveVersion, loadVersion, resolveImageRefs } from "../../api/index.js";
import { LIMITS, normalizeUrl, parseTags, validatePortfolio, newProject } from "../../engine/content.js";
import { IMAGE_REF, isPencilStale } from "../../engine/pencil.js";
import VersionPanel from "./VersionPanel.jsx";
import EdField from "./EdField.jsx";
import { useResolvedPortfolio } from "../useResolvedPortfolio.js";
import "../interview/interview.css";
import "../directions/directions.css";
import "./editor.css";

const timeText = (iso) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });

/**
 * 내용 입력: 이름·한 줄 소개·소개글·작업·이미지·링크를 고치고 미리보기로 확인.
 * - 초안은 입력이 멈추면 자동 저장(불완전해도 저장). 오류는 칸 옆에 안내만 하고 막지 않는다.
 * - 순서 이동은 위·아래 버튼(끝에서는 aria-disabled로 focus 유지), 삭제는 확인창 대신 되돌리기.
 * - 디자인 다듬기는 블루펜슬 편집기(onOpenPencil, screens/bluepencil/). 다듬은 페이지가 있으면 미리보기·발행은 그 페이지.
 */
export default function Editor({ onGoInterview, onPublish, onOpenPencil, initialFocus }) {
  const [draft, setDraft] = useState(null);
  const [render, setRender] = useState(null);
  const [saved, setSaved] = useState(null);        // 마지막 저장 시각
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState(() => new Set());
  const [tagText, setTagText] = useState({});      // 작업 id → 입력 중인 태그 글자(쉼표 입력 중에도 그대로 보이게)
  const [undo, setUndo] = useState(null);          // { kind: "project"|"link", item, index, name }
  const [announce, setAnnounce] = useState("");
  const [tab, setTab] = useState("form");          // 좁은 화면: 내용 / 미리보기
  const [versionsKey, setVersionsKey] = useState(0); // 버전을 저장하면 목록을 다시 불러온다
  const lastSnap = useRef({ at: null, json: "" }); // 자동 버전(편집 10분마다) 기준 — 첫 자동 저장부터 잰다
  const [previewDraft, setPreviewDraft] = useState(null);
  const [imgState, setImgState] = useState({});  // 작업 id → { busy } | { error } | { done }
  const [pencilHtml, setPencilHtml] = useState(null); // 다듬은 페이지 미리보기 (이미지 참조를 푼 것)
  const pendingFocus = useRef(initialFocus ?? null); // 발행 화면에서 "고치러 가기"로 왔으면 그 칸부터

  useEffect(() => {
    Promise.all([loadDraft(), import("../../templates/renderHtml.js")]).then(([loaded, mod]) => {
      // 원래 토큰이 없는 예전 초안은 지금 토큰을 기준으로 삼는다(다음 저장 때 함께 저장)
      const d = loaded.tokens && !loaded.originTokens ? { ...loaded, originTokens: loaded.tokens } : loaded;
      setDraft(d);
      setPreviewDraft(d);
      setRender(() => mod.renderPortfolioHtml);
      setTagText(Object.fromEntries(d.projects.map((p) => [p.id, p.tags.join(", ")])));
    });
  }, []);

  // 자동 저장 (입력이 0.6초 멈추면)
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(async () => {
      const r = await saveDraft(draft);
      setSaved(r.savedAt);
      setDirty(false);
      const json = JSON.stringify(draft);
      if (lastSnap.current.at === null) lastSnap.current = { at: Date.now(), json };
      else if (Date.now() - lastSnap.current.at > 10 * 60_000 && json !== lastSnap.current.json) {
        lastSnap.current = { at: Date.now(), json };
        saveVersion("자동 저장", draft).then((v) => { if (v.ok) setVersionsKey((k) => k + 1); });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [draft, dirty]);

  // 미리보기는 0.25초 늦게 (타이핑마다 iframe을 다시 그리지 않도록)
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => setPreviewDraft(draft), 250);
    return () => clearTimeout(t);
  }, [draft]);

  // 새로 추가한 칸 / 삭제 뒤 제목으로 focus
  useEffect(() => {
    if (!pendingFocus.current) return;
    const el = document.getElementById(pendingFocus.current);
    if (!el) return; // 아직 그려지지 않았으면(불러오는 중) 다음 렌더링에서 다시
    el.focus();
    pendingFocus.current = null;
  });

  const drawable = useResolvedPortfolio(previewDraft); // 이미지 참조를 푼 그리기용 사본
  const html = useMemo(() => (drawable?.tokens && drawable.template && render
    ? render({ portfolio: drawable, tokens: drawable.tokens, template: drawable.template, preview: true })
    : null), [drawable, render]);
  const thumbOf = (id) => drawable?.projects.find((x) => x.id === id)?.cover ?? null;
  const savedPencil = previewDraft?.pencil?.html ?? null;
  useEffect(() => {
    if (!savedPencil) { setPencilHtml(null); return undefined; }
    let alive = true;
    resolveImageRefs(savedPencil.match(IMAGE_REF) ?? []).then((urls) => {
      if (alive) setPencilHtml(savedPencil.replace(IMAGE_REF, (r) => urls[r] ?? r));
    });
    return () => { alive = false; };
  }, [savedPencil]);

  if (!draft) return <p role="status">불러오는 중…</p>;

  if (!draft.tokens || !draft.template) {
    return (
      <div className="iv ed">
        <h1 className="iv-question">아직 고른 안이 없어요</h1>
        <p className="iv-hint">인터뷰를 마치고 세 안 중 하나를 고르면, 그 디자인에 내용을 채울 수 있어요.</p>
        <button type="button" className="iv-btn iv-btn-primary" onClick={onGoInterview}>인터뷰로 가기</button>
      </div>
    );
  }

  const errors = validatePortfolio(draft);
  // 오류는 칸을 한 번 벗어난 뒤에만 보여준다(입력 도중에 경고가 뜨지 않게). 전체 개수는 위에 항상 표시.
  const errorFor = (path) => (touched.has(path) ? errors[path] : undefined);
  const touch = (path) => setTouched((t) => new Set(t).add(path));
  const problemCount = Object.keys(errors).length;
  const stale = isPencilStale(draft);

  /** 초안 고치기: fn이 복사본을 고친다 */
  const edit = (fn) => {
    setDraft((d) => { const next = structuredClone(d); fn(next); return next; });
    setDirty(true);
    setUndo(null);
  };
  const setPerson = (key) => (v) => edit((d) => { d.person[key] = v; });
  const setProject = (i, key) => (v) => edit((d) => { d.projects[i][key] = v; });
  const setLink = (i, key) => (v) => edit((d) => { d.person.links[i][key] = v; });

  /** 버전 기록: 지금 저장 / 되돌리기(되돌리기 전 상태도 버전으로 남긴다) */
  const saveNow = async (label) => {
    const r = await saveVersion(label, draft);
    if (r.ok) { lastSnap.current = { at: Date.now(), json: JSON.stringify(draft) }; setVersionsKey((k) => k + 1); }
    return r;
  };
  const restoreVersion = async (id) => {
    const v = await loadVersion(id);
    if (!v.ok || !v.portfolio?.tokens) return { ok: false, reason: v.reason ?? "이 버전을 불러오지 못했어요." };
    const keep = await saveVersion("되돌리기 전", draft);
    if (!keep.ok) return { ok: false, reason: `지금 상태를 먼저 남기지 못해서 되돌리지 않았어요. (${keep.reason})` };
    setDraft({ ...v.portfolio, id: draft.id, slug: draft.slug, status: draft.status });
    setDirty(true);
    setUndo(null);
    setVersionsKey((k) => k + 1);
    return { ok: true };
  };

  const move = (list, i, dir, what) => {
    const j = i + dir;
    const arr = list === "projects" ? draft.projects : draft.person.links;
    if (j < 0 || j >= arr.length) return;
    edit((d) => {
      const a = list === "projects" ? d.projects : d.person.links;
      [a[i], a[j]] = [a[j], a[i]];
    });
    setAnnounce(`${what}: ${j + 1}번째로 옮겼어요.`);
  };
  const remove = (list, i) => {
    const arr = list === "projects" ? draft.projects : draft.person.links;
    const item = arr[i];
    const name = (list === "projects" ? item.title : item.label).trim() || (list === "projects" ? "제목 없는 작업" : "이름 없는 링크");
    edit((d) => { (list === "projects" ? d.projects : d.person.links).splice(i, 1); });
    setUndo({ list, item, index: i, name });
    setAnnounce(`‘${name}’을(를) 지웠어요. 되돌리기 버튼으로 되살릴 수 있어요.`);
    pendingFocus.current = `ed-${list}-h`;
  };
  const restore = () => {
    const u = undo;
    edit((d) => { (u.list === "projects" ? d.projects : d.person.links).splice(u.index, 0, u.item); });
    setAnnounce(`‘${u.name}’을(를) 되살렸어요.`);
    pendingFocus.current = u.list === "projects" ? `ed-p-${u.item.id}-title` : `ed-l-${u.index}-label`;
  };
  const addProject = () => {
    const p = newProject();
    edit((d) => { d.projects.push(p); });
    setTagText((t) => ({ ...t, [p.id]: "" }));
    pendingFocus.current = `ed-p-${p.id}-title`;
  };
  // 이미지: 작업 id 기준 (올리는 동안 순서가 바뀌어도 맞는 작업에 들어가도록)
  const upload = async (id, e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 골라도 onChange가 오도록
    if (!file) return;
    setImgState((m) => ({ ...m, [id]: { busy: true } }));
    const r = await uploadImage(file);
    if (!r.ok) { setImgState((m) => ({ ...m, [id]: { error: r.reason } })); return; }
    edit((d) => { const pj = d.projects.find((x) => x.id === id); if (pj) pj.cover = r.ref; });
    setImgState((m) => ({ ...m, [id]: { done: `${r.width}×${r.height}, ${Math.max(1, Math.round(r.size / 1024))}KB로 줄여 저장했어요.` } }));
  };
  const removeImage = (id) => {
    edit((d) => { const pj = d.projects.find((x) => x.id === id); if (pj) { pj.cover = null; pj.coverAlt = ""; } });
    setImgState((m) => ({ ...m, [id]: { done: "이미지를 뺐어요." } }));
  };

  const addLink = () => {
    const i = draft.person.links.length;
    edit((d) => { d.person.links.push({ label: "", url: "" }); });
    pendingFocus.current = `ed-l-${i}-label`;
  };

  const orderButtons = (list, i, length, what) => (
    <div className="ed-item-actions">
      <button type="button" className="iv-btn iv-btn-quiet" aria-label={`${what} 위로`} aria-disabled={i === 0} onClick={() => move(list, i, -1, what)}>↑</button>
      <button type="button" className="iv-btn iv-btn-quiet" aria-label={`${what} 아래로`} aria-disabled={i === length - 1} onClick={() => move(list, i, 1, what)}>↓</button>
      <button type="button" className="iv-btn iv-btn-quiet ed-del" onClick={() => remove(list, i)}>지우기<span className="iv-sr">: {what}</span></button>
    </div>
  );

  return (
    <div className="iv iv-wide ed">
      <div className="ed-head">
        <div>
          <h1 className="iv-question">내용 채우기</h1>
          <p className="iv-hint">내용은 여기서, 디자인은 블루펜슬에서 다듬어요.</p>
        </div>
        <div className="ed-head-side">
          <p className="ed-status" role="status">
            {dirty ? "저장 중…" : saved ? `저장됨 · ${timeText(saved)}` : "자동으로 저장돼요"}
            {problemCount > 0 && <span className="ed-problems"> · 확인할 곳 {problemCount}군데</span>}
          </p>
          {onPublish && <button type="button" className="iv-btn iv-btn-primary" onClick={onPublish}>발행하기</button>}
        </div>
      </div>

      <div className="dr-seg ed-tabs" role="group" aria-label="보기">
        <button type="button" aria-pressed={tab === "form"} onClick={() => setTab("form")}>내용</button>
        <button type="button" aria-pressed={tab === "preview"} onClick={() => setTab("preview")}>미리보기</button>
      </div>

      <div className={`ed-layout show-${tab}`}>
        <form className="ed-form" aria-label="포트폴리오 내용" onSubmit={(e) => e.preventDefault()} noValidate>
          <section className="ed-sec" aria-labelledby="ed-basic-h">
            <h2 id="ed-basic-h">기본 정보</h2>
            <EdField id="ed-name" label="이름" required maxLength={LIMITS.name} value={draft.person.name}
              onChange={setPerson("name")} onBlur={() => touch("person.name")} error={errorFor("person.name")} />
            <EdField id="ed-headline" label="한 줄 소개" maxLength={LIMITS.headline} value={draft.person.headline}
              onChange={setPerson("headline")} hint="첫 화면에 크게 나와요." />
            <EdField id="ed-bio" label="소개글" multiline maxLength={LIMITS.bio} value={draft.person.bio}
              onChange={setPerson("bio")} hint="비워 두면 소개 섹션이 빠져요." />
          </section>

          <section className="ed-sec" aria-labelledby="ed-projects-h">
            <div className="ed-sec-head">
              <h2 id="ed-projects-h" tabIndex={-1}>작업 <span className="ed-n">{draft.projects.length}</span></h2>
              <button type="button" className="iv-btn iv-btn-quiet" onClick={addProject} disabled={draft.projects.length >= LIMITS.projects}>+ 작업 추가</button>
            </div>
            {draft.projects.length === 0 && <p className="ed-empty">아직 작업이 없어요. 작업이 없으면 작업 섹션이 빠져요.</p>}
            {draft.projects.map((p, i) => {
              const what = p.title.trim() || `${i + 1}번째 작업`;
              const base = `ed-p-${p.id}`;
              return (
                <fieldset key={p.id} className="ed-item">
                  <legend>{i + 1}. {p.title.trim() || "제목 없음"}</legend>
                  <EdField id={`${base}-title`} label="제목" required maxLength={LIMITS.title} value={p.title}
                    onChange={setProject(i, "title")} onBlur={() => touch(`projects.${i}.title`)} error={errorFor(`projects.${i}.title`)} />
                  <EdField id={`${base}-summary`} label="한 줄 설명" maxLength={LIMITS.summary} value={p.summary} onChange={setProject(i, "summary")} />
                  <div className="ed-row">
                    <EdField id={`${base}-role`} label="맡은 역할" maxLength={LIMITS.role} value={p.role} onChange={setProject(i, "role")} placeholder="예: 기획·개발" />
                    <EdField id={`${base}-year`} label="연도" maxLength={LIMITS.year} value={p.year} onChange={setProject(i, "year")} placeholder="예: 2026" />
                  </div>
                  <EdField id={`${base}-tags`} label="태그" value={tagText[p.id] ?? ""} hint={`쉼표로 구분해요. 최대 ${LIMITS.tags}개.`}
                    onChange={(v) => { setTagText((t) => ({ ...t, [p.id]: v })); setProject(i, "tags")(parseTags(v)); }}
                    onBlur={() => setTagText((t) => ({ ...t, [p.id]: p.tags.join(", ") }))} />
                  <div className="ed-image">
                    <p className="ed-label">이미지</p>
                    <div className="ed-image-row">
                      {p.cover && (thumbOf(p.id)
                        ? <img className="ed-thumb" src={thumbOf(p.id)} alt="" />
                        : <span className="ed-thumb" aria-hidden="true" />)}
                      <div className="ed-image-btns">
                        <label className={`iv-btn iv-btn-quiet ed-upload${imgState[p.id]?.busy ? " is-busy" : ""}`}>
                          {p.cover ? "바꾸기" : "이미지 올리기"}<span className="iv-sr">: {what}</span>
                          <input type="file" accept="image/*" className="iv-sr" disabled={imgState[p.id]?.busy}
                            aria-describedby={`${base}-img-hint`} onChange={(e) => upload(p.id, e)} />
                        </label>
                        {p.cover && <button type="button" className="iv-btn iv-btn-quiet" onClick={() => removeImage(p.id)}>빼기<span className="iv-sr">: {what} 이미지</span></button>}
                      </div>
                    </div>
                    <p id={`${base}-img-hint`} className="ed-hint">JPG·PNG·WebP, 15MB까지. 긴 변 1600px로 줄여서 저장해요.</p>
                    <p className={imgState[p.id]?.error ? "ed-error" : "ed-hint"} role="status">
                      {imgState[p.id]?.busy ? "줄이는 중…" : imgState[p.id]?.error ?? imgState[p.id]?.done ?? ""}
                    </p>
                  </div>
                  {p.cover && (
                    <EdField id={`${base}-alt`} label="이미지 설명" maxLength={LIMITS.alt} value={p.coverAlt ?? ""}
                      onChange={setProject(i, "coverAlt")}
                      hint="화면을 보지 못하는 사람에게 읽어 줄 설명이에요. 비워 두면 꾸밈용 이미지로 처리해요." />
                  )}
                  {orderButtons("projects", i, draft.projects.length, what)}
                </fieldset>
              );
            })}
          </section>

          <section className="ed-sec" aria-labelledby="ed-links-h">
            <div className="ed-sec-head">
              <h2 id="ed-links-h" tabIndex={-1}>링크 <span className="ed-n">{draft.person.links.length}</span></h2>
              <button type="button" className="iv-btn iv-btn-quiet" onClick={addLink} disabled={draft.person.links.length >= LIMITS.links}>+ 링크 추가</button>
            </div>
            {draft.person.links.length === 0 && <p className="ed-empty">링크가 없으면 연락 섹션이 빠져요.</p>}
            {draft.person.links.map((l, i) => {
              const what = l.label.trim() || `${i + 1}번째 링크`;
              return (
                <fieldset key={i} className="ed-item">
                  <legend>{l.label.trim() || "이름 없는 링크"}</legend>
                  <div className="ed-row">
                    <EdField id={`ed-l-${i}-label`} label="이름" required maxLength={LIMITS.label} value={l.label} placeholder="예: GitHub, 이메일"
                      onChange={setLink(i, "label")} onBlur={() => touch(`links.${i}.label`)} error={errorFor(`links.${i}.label`)} />
                    <EdField id={`ed-l-${i}-url`} label="주소" required maxLength={LIMITS.url} value={l.url} placeholder="https://… 또는 이메일 주소"
                      onChange={setLink(i, "url")}
                      onBlur={() => { touch(`links.${i}.url`); const n = normalizeUrl(l.url); if (n !== l.url) setLink(i, "url")(n); }}
                      error={errorFor(`links.${i}.url`)} />
                  </div>
                  {orderButtons("links", i, draft.person.links.length, what)}
                </fieldset>
              );
            })}
          </section>
        </form>

        <aside className="ed-preview" aria-label="미리보기">
          <section className="ed-pencil" aria-labelledby="ed-pencil-h">
            <h2 id="ed-pencil-h">디자인 다듬기</h2>
            {stale ? (
              <p className="ed-hint">내용을 바꾼 뒤로 다듬은 페이지에 아직 반영되지 않았어요. 블루펜슬에서 “내용으로 다시 만들기”를 누르면 반영돼요.</p>
            ) : (
              <p className="ed-hint">{draft.pencil ? "블루펜슬에서 다듬은 페이지가 발행돼요." : "블루펜슬 편집기에서 표시·메모·직접 고치기·슬라이더·Claude 대화로 디자인을 다듬어요."}</p>
            )}
            {onOpenPencil && <button type="button" className="iv-btn iv-btn-primary" onClick={onOpenPencil}>블루펜슬로 다듬기</button>}
          </section>
          {(pencilHtml ?? html) && (
            <iframe className="ed-frame" title={draft.pencil ? "다듬은 페이지 미리보기" : "미리보기"} sandbox="" srcDoc={pencilHtml ?? html} />
          )}
          <VersionPanel onSave={saveNow} onRestore={restoreVersion} refreshKey={versionsKey} />
        </aside>
      </div>

      <p className="iv-sr" aria-live="polite">{announce}</p>
      {undo && (
        <div className="ed-toast">
          <span>‘{undo.name}’을(를) 지웠어요.</span>
          <button type="button" className="iv-btn iv-btn-quiet" onClick={restore}>되돌리기</button>
        </div>
      )}
    </div>
  );
}
