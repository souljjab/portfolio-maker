import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { fieldLabel } from "./fields.js";
import MarkLayer from "./MarkLayer.jsx";
import TunePanel from "./TunePanel.jsx";

const DEVICES = { desktop: { label: "데스크톱", w: 1280 }, tablet: { label: "태블릿", w: 820 }, mobile: { label: "모바일", w: 390 } };
/** 누르면: edit 그 자리에서 고치기 / note Claude에게 줄 메모 달기 / view 보기만(링크 새 창) */
const MODES = { edit: "고치기", tune: "조절", note: "메모", view: "보기만" };
/** 메모 도구 (블루펜슬): 칸 누르기 / 영역 드래그 / 펜 / 화살표 */
const NOTE_TOOLS = { click: "누르기", region: "영역", draw: "펜", arrow: "화살표" };
const NOTE_HINT = {
  click: "메모할 칸을 누르세요.",
  region: "바꿀 영역을 드래그하세요. 영역 안의 칸이 메모 대상이 돼요.",
  draw: "고칠 곳에 그어 보세요. 메모를 남기기 전까지 여러 번 그으면 한 메모로 묶여요.",
  arrow: "옮기거나 이어 줄 곳에서 도착할 곳까지 끌어 주세요.",
};
const HINT = {
  edit: "글자를 누르면 그 자리에서 고쳐요. 작업·링크를 누르면 왼쪽 입력 칸으로 가요.",
  note: "바꾸고 싶은 곳을 누르고 메모를 남기세요. 아래에서 Claude에게 한 번에 부탁할 수 있어요.",
  tune: "크기·간격을 바꿀 곳을 누르세요. 빈 곳을 누르면 페이지 전체를 조절해요.",
  view: "보기만 하는 중이에요. 링크는 새 창으로 열려요.",
};

/** 미리보기에서 바로 고칠 수 있는 글 칸 (그 밖의 칸은 누르면 왼쪽 입력 칸으로 이동) */
const INLINE = /^(name|headline|bio|project\.\d+\.(title|summary))$/;

const hooked = new WeakSet(); // 이미 클릭·호버를 붙인 iframe 문서

// 캔버스 안에만 넣는 편집 표시 (발행 HTML과는 무관 — 부모 문서가 iframe에 직접 붙인다)
const EDIT_CSS = `[data-pf-field]{cursor:pointer}
[data-pf-field].pf-ed-hover{outline:2px dashed #2745D6;outline-offset:3px}
[data-pf-field].pf-ed-on{outline:2px solid #2745D6;outline-offset:3px}
[data-pf-note]{outline:2px solid #C2361B;outline-offset:3px;position:relative}
[data-pf-note]::before{--k:var(--pf-ed-k,1);content:attr(data-pf-note);position:absolute;top:calc(-13px*var(--k));left:calc(-13px*var(--k));z-index:60;min-width:calc(24px*var(--k));height:calc(24px*var(--k));padding:0 calc(6px*var(--k));border-radius:999px;background:#C2361B;color:#fff;font:700 calc(13px*var(--k))/calc(24px*var(--k)) system-ui,sans-serif;text-align:center;letter-spacing:0}`;

/**
 * 편집 캔버스: 발행 결과와 같은 정적 HTML을 기기 폭으로 그리고, 누른 칸을 알려 준다.
 * iframe은 스크립트 불가 샌드박스 그대로 두고 allow-same-origin만 줘서 부모가 클릭·호버를 받는다
 * (문서는 우리가 템플릿으로 만든 것이고 스크립트는 한 줄도 실행되지 않는다).
 * 키보드·스크린리더 사용자는 왼쪽 입력 칸과 아래 부탁 칸으로 같은 것을 모두 할 수 있다.
 * @param {{ html: string, device: keyof DEVICES, onDevice: (d) => void,
 *           getValue: (field) => string, maxLength: (field) => number,
 *           onInline: (field, value) => void, onPick: (field) => void,
 *           notes: {kind, target?, targets?, to?, request, mark?}[], onAddNote: (note) => void,
 *           template: string, tokens, onTune: (path, value) => void }} props
 */
export default function EditCanvas({ html, device, onDevice, getValue, maxLength, onInline, onPick, notes, onAddNote, template, tokens, onTune }) {
  const boxRef = useRef(null);
  const frameRef = useRef(null);
  const scroll = useRef(0);
  const [boxW, setBoxW] = useState(600);
  const [mode, setMode] = useState("edit");
  const [noteTool, setNoteTool] = useState("click");
  const [tuneField, setTuneField] = useState("page"); // 조절 모드에서 고른 곳
  const pickTune = useCallback((f) => setTuneField(f), []);
  const [scrollTop, setScrollTop] = useState(0); // 표시(영역·펜·화살표)를 스크롤에 맞춰 다시 그리기 위해
  const [inline, setInline] = useState(null);   // { html, kind: "edit"|"note", field, value, rect, mark? }
  const picked = useRef(null);                   // 지금 고치는 칸의 요소 (윤곽선 지우기용)
  const devW = DEVICES[device].w;
  // 미리보기 칸이 숨겨져 폭이 0일 때(좁은 화면의 입력 보기)도 0으로 나누지 않게
  const scale = boxW > 0 ? Math.min(1, boxW / devW) : 1;
  const offX = Math.max(0, (boxW - devW * scale) / 2); // 좁은 기기는 가운데에
  const viewH = 720; // 캔버스 높이(px, 화면 기준)

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  // 최신 값을 iframe 이벤트에서 쓰기 위한 참조 (문서가 바뀔 때마다 다시 붙이지 않게)
  const live = useRef({});
  useLayoutEffect(() => { live.current = { mode, noteTool, scale, getValue, onPick, html, pickTune }; });

  /** 메모 번호 배지를 문서에 표시 (다시 그려질 때마다) */
  const markNotes = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    doc.documentElement.style.setProperty("--pf-ed-k", String(1 / (live.current.scale || 1)));
    doc.querySelectorAll("[data-pf-note]").forEach((el) => el.removeAttribute("data-pf-note"));
    const nums = {};
    (notes ?? []).forEach((n, i) => { if (!n.mark && n.target) (nums[n.target] ??= []).push(i + 1); });
    for (const [target, list] of Object.entries(nums)) {
      doc.querySelector(`[data-pf-field="${CSS.escape(target)}"]`)?.setAttribute("data-pf-note", list.join("·"));
    }
  }, [notes]);

  const hook = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    // srcdoc 문서가 다 그려진 뒤, 문서마다 한 번만 (load 이벤트를 놓치는 경우가 있어 effect에서도 부른다)
    if (!doc?.body || doc.readyState !== "complete" || hooked.has(doc) || !doc.querySelector("[data-pf-field]")) return;
    hooked.add(doc);
    const style = doc.createElement("style");
    style.textContent = EDIT_CSS;
    doc.head.append(style);
    const se = doc.scrollingElement;
    se?.scrollTo(0, scroll.current); // 다시 그려도 보던 위치 그대로
    let raf = 0;
    doc.addEventListener("scroll", () => {
      scroll.current = se?.scrollTop ?? 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollTop(scroll.current));
    }, { passive: true });
    setScrollTop(scroll.current);
    let hovered = null;
    doc.addEventListener("mouseover", (e) => {
      const el = live.current.mode === "view" ? null : e.target.closest?.("[data-pf-field]");
      if (hovered && hovered !== el) hovered.classList.remove("pf-ed-hover");
      hovered = el;
      el?.classList.add("pf-ed-hover");
    });
    doc.addEventListener("click", (e) => {
      const { mode: m, scale: s } = live.current;
      if (m === "view" || (m === "note" && live.current.noteTool !== "click")) return;
      e.preventDefault(); // 고치기·메모 중엔 링크를 열지 않는다
      const el = e.target.closest?.("[data-pf-field]");
      if (m === "tune") {
        // 조절: 누른 칸(없으면 페이지 전체)을 골라 표시만 한다
        picked.current?.classList.remove("pf-ed-on");
        picked.current = el;
        el?.classList.add("pf-ed-on");
        live.current.pickTune(el?.dataset.pfField ?? "page");
        return;
      }
      if (!el) return;
      const field = el.dataset.pfField;
      if (m === "edit" && !INLINE.test(field)) { live.current.onPick(field); return; }
      const r = el.getBoundingClientRect();
      picked.current?.classList.remove("pf-ed-on");
      picked.current = el;
      el.classList.add("pf-ed-on");
      setInline({
        html: live.current.html, kind: m, field,
        value: m === "edit" ? live.current.getValue(field) : "",
        rect: { top: r.bottom * s + 6, left: r.left * s, width: Math.max(r.width * s, 280) }, // 고치는 글이 가려지지 않게 바로 아래
      });
    });
    markNotes();
  }, [markNotes]);

  useEffect(() => {
    hook();
    const t = setInterval(hook, 150); // 새 문서가 준비되는 시점을 놓치지 않게 (붙으면 hook이 바로 돌아감)
    const stop = setTimeout(() => clearInterval(t), 3000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [html, device, hook]);
  useEffect(() => { markNotes(); }, [markNotes]);
  // 축소된 미리보기에서도 메모 번호가 같은 크기로 보이게
  useEffect(() => { frameRef.current?.contentDocument?.documentElement?.style.setProperty("--pf-ed-k", String(1 / scale)); });

  // 문서가 새로 그려지면(내용·디자인 변경) 열려 있던 칸은 닫힌 것으로 본다
  const open = inline && inline.html === html ? inline : null;
  // 칸을 닫으면 윤곽선도 지운다
  useEffect(() => { if (!open && mode !== "tune") { picked.current?.classList.remove("pf-ed-on"); picked.current = null; } }, [open, mode]);
  /** 조절 중: 미리보기 문서의 CSS 변수를 바로 바꿔 즉시 보여 준다(저장은 onTune → 다시 그리기) */
  const liveVar = (cssVar, value) => frameRef.current?.contentDocument?.querySelector(".pf")?.style.setProperty(cssVar, String(value));

  const commit = () => {
    if (open?.kind === "edit" && open.value !== getValue(open.field)) onInline(open.field, open.value);
    if (open?.kind === "note" && open.value.trim()) {
      const request = open.value.trim();
      onAddNote(open.mark
        ? { kind: open.mark.kind, targets: open.mark.targets, to: open.mark.to ?? undefined, request, mark: open.mark.shape }
        : { kind: "element", target: open.field, request });
    }
    setInline(null);
  };
  /** 표시를 다 그렸을 때: 메모 칸을 연다 (펜은 열린 칸이 있으면 획을 더한다) */
  const onMarkDone = (kind, shape, targets, to, anchor) => {
    setInline((cur) => ({
      html, kind: "note", field: targets[0], value: cur?.mark?.kind === kind ? cur.value : "",
      mark: { kind, shape, targets, to },
      rect: { top: anchor.top, left: Math.max(0, anchor.left - offX - 140), width: 300 },
    }));
  };
  const markTool = mode === "note" && noteTool !== "click" ? noteTool : null;
  const drawnMarks = (notes ?? []).map((n, i) => (n.mark ? { no: String(i + 1), kind: n.kind, mark: n.mark } : null)).filter(Boolean);

  return (
    <div className="ec">
      <div className="ec-bar">
        <div className="dr-seg" role="group" aria-label="화면 크기">
          {Object.entries(DEVICES).map(([k, d]) => (
            <button key={k} type="button" aria-pressed={device === k} onClick={() => onDevice(k)}>{d.label}</button>
          ))}
        </div>
        <div className="dr-seg" role="group" aria-label="미리보기를 누르면">
          {Object.entries(MODES).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => { setMode(k); setInline(null); }}>{label}</button>
          ))}
        </div>
      </div>
      {mode === "note" && (
        <div className="dr-seg ec-tools" role="group" aria-label="메모 도구">
          {Object.entries(NOTE_TOOLS).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={noteTool === k} onClick={() => { setNoteTool(k); setInline(null); }}>{label}</button>
          ))}
        </div>
      )}
      <p className="iv-meta iv-left ec-hint">{mode === "note" ? NOTE_HINT[noteTool] : HINT[mode]}</p>
      {mode === "tune" && tokens && <TunePanel field={tuneField} template={template} tokens={tokens} onChange={onTune} onLive={liveVar} />}
      <div ref={boxRef} className="ec-box" style={{ height: viewH }}>
        <iframe
          ref={frameRef}
          key={device}
          srcDoc={html}
          title="내 포트폴리오 미리보기"
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          onLoad={hook}
          style={{ left: offX, width: devW, height: viewH / scale, transform: `scale(${scale})` }}
        />
        <MarkLayer tool={markTool} scale={scale} offX={offX} scrollTop={scrollTop} frameRef={frameRef}
          marks={drawnMarks} draft={open?.mark ? { kind: open.mark.kind, mark: open.mark.shape } : null}
          onDone={onMarkDone} />
        {open && (
          <div className={`ec-inline is-${open.kind}`} style={{ top: Math.min(open.rect.top, viewH - 160), left: Math.min(open.rect.left + offX, Math.max(0, boxW - open.rect.width)), width: Math.min(open.rect.width, boxW) }}>
            <textarea
              aria-label={open.kind === "edit" ? `${fieldLabel(open.field)} 고치기` : `${open.mark ? `${NOTE_TOOLS[open.mark.kind]} 표시(${open.mark.targets.map(fieldLabel).join(", ")})` : fieldLabel(open.field)}에 남길 메모`}
              placeholder={open.kind === "note" ? "어떻게 바꿀까요? 예: 더 짧게, 더 대담하게, 따뜻한 말투로" : undefined}
              autoFocus
              rows={open.field === "bio" || open.kind === "note" ? 3 : 2}
              maxLength={open.kind === "edit" ? maxLength(open.field) : 200}
              value={open.value}
              onChange={(e) => setInline((s) => ({ ...s, value: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.preventDefault(); setInline(null); }
                if (e.key === "Enter" && !e.shiftKey && open.field !== "bio") { e.preventDefault(); commit(); }
              }}
            />
            <div className="ec-inline-btns">
              <button type="button" className="iv-btn iv-btn-primary" onMouseDown={(e) => e.preventDefault()} onClick={commit}>
                {open.kind === "edit" ? "적용" : "메모 남기기"}
              </button>
              <button type="button" className="iv-btn iv-btn-quiet" onClick={() => setInline(null)}>취소</button>
              {open.kind === "edit" && (
                <button type="button" className="iv-btn iv-btn-quiet" onClick={() => { const f = open.field; setInline(null); onPick(f); }}>입력 칸으로</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
