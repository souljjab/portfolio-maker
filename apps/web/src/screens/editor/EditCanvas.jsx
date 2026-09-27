import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const DEVICES = { desktop: { label: "데스크톱", w: 1280 }, tablet: { label: "태블릿", w: 820 }, mobile: { label: "모바일", w: 390 } };

/** 미리보기에서 바로 고칠 수 있는 글 칸 (그 밖의 칸은 누르면 왼쪽 입력 칸으로 이동) */
const INLINE = /^(name|headline|bio|project\.\d+\.(title|summary))$/;
const fieldLabel = (f) => ({ name: "이름", headline: "한 줄 소개", bio: "소개글" }[f]
  ?? (/\.title$/.test(f) ? "작업 제목" : /\.summary$/.test(f) ? "작업 한 줄 설명" : /^links\./.test(f) ? "링크" : "작업"));

const hooked = new WeakSet(); // 이미 클릭·호버를 붙인 iframe 문서

// 캔버스 안에만 넣는 편집 표시 (발행 HTML과는 무관 — 부모 문서가 iframe에 직접 붙인다)
const EDIT_CSS = `[data-pf-field]{cursor:pointer}
[data-pf-field].pf-ed-hover{outline:2px dashed #2745D6;outline-offset:3px}
[data-pf-field].pf-ed-on{outline:2px solid #2745D6;outline-offset:3px}`;

/**
 * 편집 캔버스: 발행 결과와 같은 정적 HTML을 기기 폭으로 그리고, 누른 칸을 알려 준다.
 * iframe은 스크립트 불가 샌드박스 그대로 두고 allow-same-origin만 줘서 부모가 클릭·호버를 받는다
 * (문서는 우리가 템플릿으로 만든 것이고 스크립트는 한 줄도 실행되지 않는다).
 * 키보드·스크린리더 사용자는 왼쪽 입력 칸으로 같은 것을 모두 고칠 수 있다.
 * @param {{ html: string, device: keyof DEVICES, onDevice: (d) => void,
 *           getValue: (field) => string, maxLength: (field) => number,
 *           onInline: (field, value) => void, onPick: (field) => void }} props
 */
export default function EditCanvas({ html, device, onDevice, getValue, maxLength, onInline, onPick }) {
  const boxRef = useRef(null);
  const frameRef = useRef(null);
  const scroll = useRef(0);
  const [boxW, setBoxW] = useState(600);
  const [editing, setEditing] = useState(true); // false: 보기만 (링크 새 창으로 열기)
  const [inline, setInline] = useState(null);   // { field, value, rect }
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

  // 최신 콜백을 iframe 이벤트에서 쓰기 위한 참조 (문서가 바뀔 때마다 다시 붙이지 않게)
  const live = useRef({});
  useLayoutEffect(() => { live.current = { editing, scale, getValue, onPick, html }; });

  const hook = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    // srcdoc 문서가 다 그려진 뒤, 문서마다 한 번만 (load 이벤트를 놓치는 경우가 있어 effect에서도 부른다)
    if (!doc?.body || doc.readyState !== "complete" || hooked.has(doc) || !doc.querySelector("[data-pf-field]")) return;
    hooked.add(doc);
    const style = doc.createElement("style");
    style.textContent = EDIT_CSS;
    doc.head.append(style);
    doc.documentElement.classList.toggle("pf-ed", true);
    const se = doc.scrollingElement;
    if (se) se.scrollTop = scroll.current; // 다시 그려도 보던 위치 그대로
    doc.addEventListener("scroll", () => { scroll.current = se?.scrollTop ?? 0; }, { passive: true });
    let hovered = null;
    doc.addEventListener("mouseover", (e) => {
      if (!live.current.editing) return;
      const el = e.target.closest?.("[data-pf-field]");
      if (hovered && hovered !== el) hovered.classList.remove("pf-ed-hover");
      hovered = el;
      el?.classList.add("pf-ed-hover");
    });
    doc.addEventListener("click", (e) => {
      if (!live.current.editing) return;
      e.preventDefault(); // 고치기 중엔 링크를 열지 않는다
      const el = e.target.closest?.("[data-pf-field]");
      if (!el) return;
      const field = el.dataset.pfField;
      if (!INLINE.test(field)) { live.current.onPick(field); return; }
      const r = el.getBoundingClientRect(), s = live.current.scale;
      picked.current?.classList.remove("pf-ed-on");
      picked.current = el;
      el.classList.add("pf-ed-on");
      setInline({ html: live.current.html, field, value: live.current.getValue(field), rect: { top: r.bottom * s + 6, left: r.left * s, width: Math.max(r.width * s, 260) } }); // 고치는 글이 가려지지 않게 바로 아래
    });
  }, []);

  useEffect(() => {
    hook();
    const t = setInterval(hook, 150); // 새 문서가 준비되는 시점을 놓치지 않게 (붙으면 hook이 바로 돌아감)
    const stop = setTimeout(() => clearInterval(t), 3000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [html, device, hook]);

  // 문서가 새로 그려지면(내용·디자인 변경) 열려 있던 칸은 닫힌 것으로 본다
  const open = inline && inline.html === html ? inline : null;
  // 칸을 닫으면 윤곽선도 지운다
  useEffect(() => { if (!open) { picked.current?.classList.remove("pf-ed-on"); picked.current = null; } }, [open]);

  const commit = () => {
    if (open && open.value !== getValue(open.field)) onInline(open.field, open.value);
    setInline(null);
  };

  return (
    <div className="ec">
      <div className="ec-bar">
        <div className="dr-seg" role="group" aria-label="화면 크기">
          {Object.entries(DEVICES).map(([k, d]) => (
            <button key={k} type="button" aria-pressed={device === k} onClick={() => onDevice(k)}>{d.label}</button>
          ))}
        </div>
        <label className="ec-toggle">
          <input type="checkbox" checked={editing} onChange={(e) => { setEditing(e.target.checked); setInline(null); }} />
          누르면 고치기
        </label>
      </div>
      <p className="iv-meta iv-left ec-hint">
        {editing ? "미리보기에서 글자를 누르면 그 자리에서 고칠 수 있어요. 작업·링크를 누르면 왼쪽 입력 칸으로 가요." : "보기만 하는 중이에요. 링크는 새 창으로 열려요."}
      </p>
      <div ref={boxRef} className="ec-box" style={{ height: viewH }}>
        <iframe
          ref={frameRef}
          key={device}
          srcDoc={html}
          title="내 포트폴리오 미리보기 (누르면 고치기)"
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          onLoad={hook}
          style={{ left: offX, width: devW, height: viewH / scale, transform: `scale(${scale})` }}
        />
        {open && (
          <div className="ec-inline" style={{ top: Math.min(open.rect.top, viewH - 150), left: Math.min(open.rect.left + offX, Math.max(0, boxW - open.rect.width)), width: Math.min(open.rect.width, boxW) }}>
            <textarea
              aria-label={`${fieldLabel(open.field)} 고치기`}
              autoFocus
              rows={open.field === "bio" ? 4 : 2}
              maxLength={maxLength(open.field)}
              value={open.value}
              onChange={(e) => setInline((s) => ({ ...s, value: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.preventDefault(); setInline(null); }
                if (e.key === "Enter" && !e.shiftKey && open.field !== "bio") { e.preventDefault(); commit(); }
              }}
            />
            <div className="ec-inline-btns">
              <button type="button" className="iv-btn iv-btn-primary" onMouseDown={(e) => e.preventDefault()} onClick={commit}>적용</button>
              <button type="button" className="iv-btn iv-btn-quiet" onClick={() => setInline(null)}>취소</button>
              <button type="button" className="iv-btn iv-btn-quiet" onClick={() => { const f = open.field; setInline(null); onPick(f); }}>입력 칸으로</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
