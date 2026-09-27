import { useEffect, useMemo, useRef, useState } from "react";
import { loadDraft, saveDraft, uploadImage, loadInterview, saveInterview, requestAiEdit } from "../../api/index.js";
import { acceptAiEdits } from "../../engine/aiEdits.js";
import { tokenEdits } from "../../engine/edits.js";
import { replayAnswers } from "../../engine/replay.js";
import { LIMITS, normalizeUrl, parseTags, validatePortfolio, newProject } from "../../engine/content.js";
import EditCanvas from "./EditCanvas.jsx";
import AskPanel from "./AskPanel.jsx";
import EdField from "./EdField.jsx";
import DesignPanel from "./DesignPanel.jsx";
import { useResolvedPortfolio } from "../useResolvedPortfolio.js";
import "../interview/interview.css";
import "../directions/directions.css";
import "./editor.css";

/**
 * 디자인 편집 기록을 인터뷰 세션에 남기고 DNA를 다시 계산한다 (edit 신호, 가중치 가장 큼).
 * 3안을 고른 세션이 있을 때만 — 편집은 고른 안을 기준으로 한 차이라서.
 */
async function recordEditsToSession(changes) {
  const session = await loadInterview();
  if (!session.answers.directions) return;
  const answers = { ...session.answers, edits: { changes } };
  if (!changes.length) delete answers.edits;
  await saveInterview({ ...session, answers, dna: replayAnswers(answers) });
}

const timeText = (iso) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });

/**
 * 편집기(콘텐츠만): 이름·한 줄 소개·소개글·작업·링크를 고치고 실시간 미리보기로 확인.
 * - 초안은 입력이 멈추면 자동 저장(불완전해도 저장). 오류는 칸 옆에 안내만 하고 막지 않는다.
 * - 순서 이동은 위·아래 버튼(끝에서는 aria-disabled로 focus 유지), 삭제는 확인창 대신 되돌리기.
 * - 디자인(템플릿·토큰)은 인터뷰에서 고른 안 그대로. 토큰 조정은 다음 범위.
 */
export default function Editor({ onGoInterview, onPublish, initialFocus }) {
  const [draft, setDraft] = useState(null);
  const [render, setRender] = useState(null);
  const [saved, setSaved] = useState(null);        // 마지막 저장 시각
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState(() => new Set());
  const [tagText, setTagText] = useState({});      // 작업 id → 입력 중인 태그 글자(쉼표 입력 중에도 그대로 보이게)
  const [undo, setUndo] = useState(null);          // { kind: "project"|"link", item, index, name }
  const [announce, setAnnounce] = useState("");
  const [tab, setTab] = useState("form");          // 좁은 화면: 내용 / 미리보기
  const [device, setDevice] = useState("desktop");
  const [notes, setNotes] = useState([]);           // 캔버스에서 단 Claude용 메모 [{ kind, target | targets, to?, request, mark? }]
  const [askMessage, setAskMessage] = useState("");
  const [askBusy, setAskBusy] = useState(false);
  const [askResult, setAskResult] = useState(null); // { reply, changes, skipped, before } | { error }
  const [, setFocusTick] = useState(0); // 캔버스에서 칸을 눌렀을 때 다시 그려 focus 이동 effect를 돌린다
  const [previewDraft, setPreviewDraft] = useState(null);
  const [imgState, setImgState] = useState({});  // 작업 id → { busy } | { error } | { done }
  const [designNote, setDesignNote] = useState("");
  const recordedEdits = useRef(null);            // 마지막으로 인터뷰 세션에 기록한 편집 (같으면 다시 쓰지 않음)
  const pendingFocus = useRef(initialFocus ?? null); // 발행 화면에서 "고치러 가기"로 왔으면 그 칸부터

  useEffect(() => {
    Promise.all([loadDraft(), import("../../templates/renderHtml.js")]).then(([loaded, mod]) => {
      // 원래 토큰이 없는 예전 초안은 지금 토큰을 기준으로 삼는다(다음 저장 때 함께 저장)
      const d = loaded.tokens && !loaded.originTokens ? { ...loaded, originTokens: loaded.tokens } : loaded;
      recordedEdits.current = JSON.stringify(tokenEdits(d.originTokens, d.tokens));
      setDraft(d);
      setPreviewDraft(d);
      setRender(() => mod.renderPortfolioHtml);
      setTagText(Object.fromEntries(d.projects.map((p) => [p.id, p.tags.join(", ")])));
    });
  }, []);

  /** 저장 뒤: 디자인 편집이 달라졌으면 세션에 기록 */
  function recordEdits(d) {
    const changes = tokenEdits(d.originTokens, d.tokens);
    const key = JSON.stringify(changes);
    if (key === recordedEdits.current) return;
    recordedEdits.current = key;
    recordEditsToSession(changes);
  }

  // 자동 저장 (입력이 0.6초 멈추면)
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(async () => {
      const r = await saveDraft(draft);
      setSaved(r.savedAt);
      setDirty(false);
      recordEdits(draft);
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
    ? render({ portfolio: drawable, tokens: drawable.tokens, template: drawable.template, preview: true, editable: true })
    : null), [drawable, render]);
  const thumbOf = (id) => drawable?.projects.find((x) => x.id === id)?.cover ?? null;

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

  /** 초안 고치기: fn이 복사본을 고친다 */
  const edit = (fn) => {
    setDraft((d) => { const next = structuredClone(d); fn(next); return next; });
    setDirty(true);
    setUndo(null);
  };
  const setPerson = (key) => (v) => edit((d) => { d.person[key] = v; });
  const setProject = (i, key) => (v) => edit((d) => { d.projects[i][key] = v; });
  const setLink = (i, key) => (v) => edit((d) => { d.person.links[i][key] = v; });

  // 캔버스의 칸 이름(data-pf-field) ↔ 초안·입력 칸
  const PERSON_LIMIT = { name: LIMITS.name, headline: LIMITS.headline, bio: LIMITS.bio };
  const projectOf = (field) => {
    const m = /^project\.(\d+)(?:\.(title|summary))?$/.exec(field);
    return m && draft.projects[+m[1]] ? { p: draft.projects[+m[1]], i: +m[1], key: m[2] } : null;
  };
  const canvasValue = (field) => (field in PERSON_LIMIT ? draft.person[field] : projectOf(field)?.p[projectOf(field).key] ?? "");
  const canvasMax = (field) => PERSON_LIMIT[field] ?? (projectOf(field)?.key === "summary" ? LIMITS.summary : LIMITS.title);
  const canvasInline = (field, value) => {
    const v = value.slice(0, canvasMax(field));
    if (field in PERSON_LIMIT) return setPerson(field)(v);
    const pj = projectOf(field);
    if (pj?.key) setProject(pj.i, pj.key)(v);
  };
  const canvasSnippet = (field) => {
    if (/^links\./.test(field)) return draft.person.links[+field.split(".")[1]]?.label ?? "";
    const pj = projectOf(field);
    const v = pj && !pj.key ? pj.p.title : canvasValue(field);
    return v.length > 24 ? `${v.slice(0, 24)}…` : v;
  };

  /** Claude에게 메모·부탁을 보내고, 돌아온 변경을 이 초안에 다시 검사해 적용 (되돌리기용으로 이전 초안 보관) */
  const askClaude = async () => {
    setAskBusy(true);
    setAskResult(null);
    const before = draft;
    const r = await requestAiEdit({ portfolio: before, notes, message: askMessage });
    setAskBusy(false);
    if (!r.ok) { setAskResult({ error: r.reason ?? "부탁을 보내지 못했어요." }); return; }
    const acc = acceptAiEdits(r, before);
    if (acc.changes.length) {
      setDraft(acc.draft);
      setDirty(true);
      setUndo(null);
      setNotes([]);
      setAskMessage("");
    }
    setAskResult({ reply: acc.reply, changes: acc.changes, skipped: acc.skipped, before });
  };
  const undoClaude = () => {
    if (!askResult?.before) return;
    setDraft(askResult.before);
    setDirty(true);
    setAskResult(null);
    setAnnounce("Claude가 바꾼 곳을 모두 되돌렸어요.");
  };

  const canvasPick = (field) => {
    const pj = projectOf(field);
    const link = /^links\.(\d+)$/.exec(field);
    const id = field in PERSON_LIMIT ? `ed-${field}`
      : pj ? `ed-p-${pj.p.id}-${pj.key ?? "title"}`
      : link ? `ed-l-${link[1]}-label` : null;
    if (!id) return;
    pendingFocus.current = id;
    setTab("form"); // 좁은 화면에선 입력 칸이 다른 탭에 있다
    setFocusTick((t) => t + 1);
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
          <p className="iv-hint">디자인은 고른 안 그대로예요. 내용을 바꾸면 미리보기에 바로 보여요.</p>
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
          <section className="ed-sec" aria-labelledby="ed-design-h">
            <h2 id="ed-design-h">디자인 다듬기</h2>
            <p className="iv-meta iv-left">배치는 고른 안 그대로 두고 색·글꼴·크기를 바꾸거나 개성 포인트를 얹을 수 있어요.</p>
            <DesignPanel
              tokens={draft.tokens}
              origin={draft.originTokens ?? draft.tokens}
              onChange={(t, note) => { edit((d) => { d.tokens = t; }); setDesignNote(note); }}
            />
            <p className="ed-hint" role="status">{designNote}</p>
          </section>
        </form>

        <aside className="ed-preview" aria-label="미리보기">
          {html && (
            <EditCanvas html={html} device={device} onDevice={setDevice}
              getValue={canvasValue} maxLength={canvasMax} onInline={canvasInline} onPick={canvasPick}
              notes={notes} onAddNote={(note) => { setNotes((n) => [...n, note]); setAnnounce(`${notes.length + 1}번 메모를 남겼어요.`); }}
              template={draft.template} tokens={draft.tokens}
              onTune={(path, value) => edit((d) => {
                const [group, key] = path.split(".");
                if (group === "tune") d.tokens.tune = { ...(d.tokens.tune ?? {}), [key]: value };
                else d.tokens[group][key] = value;
                if (path === "radius.lg") d.tokens.radius.sm = Math.round(value * 0.4);
              })} />
          )}
          <AskPanel notes={notes} onRemoveNote={(i) => setNotes((n) => n.filter((_, k) => k !== i))}
            message={askMessage} onMessage={setAskMessage} busy={askBusy} onAsk={askClaude}
            result={askResult} onUndo={undoClaude} snippet={canvasSnippet} />
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
