import { useRef, useState } from "react";

/**
 * 미리보기 위에 그리는 표시 (블루펜슬의 영역·펜·화살표). 그린 것은 Claude에게 가는 메모가 된다.
 * 좌표는 iframe 문서 기준(축소 전 px, 스크롤 포함)으로 저장해서 스크롤·기기 폭이 바뀌어도 제자리에 그린다.
 * 대상 칸은 문서 안 [data-pf-field] 요소 중 가운데가 표시 범위 안에 들어온 것(바깥 칸이 잡히면 안쪽 칸은 뺌).
 * @param {{ tool: "region"|"draw"|"arrow"|null, scale: number, offX: number, scrollTop: number,
 *           frameRef: React.RefObject<HTMLIFrameElement>, marks: {no: string, kind, mark}[],
 *           draft: null | {kind, mark}, onDone: (kind, mark, targets, to, anchor) => void }} props
 */
export default function MarkLayer({ tool, scale, offX, scrollTop, frameRef, marks, draft, onDone }) {
  const drawing = useRef(null);
  const [live, setLive] = useState(null); // 그리는 중인 표시

  // 화면(상자) 좌표 ↔ 문서 좌표
  const toDoc = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - r.left - offX) / scale, (e.clientY - r.top) / scale + scrollTop];
  };
  const toBox = ([x, y]) => [x * scale + offX, (y - scrollTop) * scale];

  /** 문서 좌표의 사각형 안에 가운데가 들어온 칸 (바깥 칸 우선) */
  function fieldsIn(x1, y1, x2, y2) {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return [];
    const [l, t, r, b] = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
    const hits = [...doc.querySelectorAll("[data-pf-field]")].filter((el) => {
      const q = el.getBoundingClientRect();
      const cx = q.left + q.width / 2, cy = q.top + scrollTop + q.height / 2;
      return q.width > 0 && cx >= l && cx <= r && cy >= t && cy <= b;
    });
    return hits.filter((el) => !hits.some((o) => o !== el && o.contains(el))).map((el) => el.dataset.pfField);
  }
  const fieldAt = ([x, y]) => {
    const doc = frameRef.current?.contentDocument;
    return doc?.elementFromPoint(x, y - scrollTop)?.closest?.("[data-pf-field]")?.dataset.pfField ?? null;
  };

  const down = (e) => {
    if (!tool) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toDoc(e);
    drawing.current = { start: p, points: [p] };
    setLive({ kind: tool, mark: tool === "draw" ? { strokes: [[p]] } : { from: p, to: p } });
  };
  const move = (e) => {
    if (!drawing.current) return;
    const p = toDoc(e);
    drawing.current.points.push(p);
    setLive((s) => (s.kind === "draw" ? { ...s, mark: { strokes: [drawing.current.points] } } : { ...s, mark: { from: drawing.current.start, to: p } }));
  };
  const up = (e) => {
    const d = drawing.current;
    drawing.current = null;
    if (!d) return;
    const end = toDoc(e);
    setLive(null);
    const tiny = Math.hypot(end[0] - d.start[0], end[1] - d.start[1]) < 6 / scale;
    if (tiny && tool !== "draw") return; // 거의 안 움직였으면 무시
    let kind = tool, mark, targets, to = null;
    if (tool === "draw") {
      // 펜은 메모를 남기기 전까지 여러 번 그으면 한 표시로 묶인다
      const strokes = [...(draft?.kind === "draw" ? draft.mark.strokes : []), d.points];
      const xs = strokes.flat().map((p) => p[0]), ys = strokes.flat().map((p) => p[1]);
      mark = { strokes };
      targets = fieldsIn(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    } else if (tool === "region") {
      mark = { from: d.start, to: end };
      targets = fieldsIn(d.start[0], d.start[1], end[0], end[1]);
    } else {
      mark = { from: d.start, to: end };
      const from = fieldAt(d.start);
      to = fieldAt(end);
      targets = from ? [from] : [];
    }
    const [ax, ay] = toBox(end);
    onDone(kind, mark, targets.length ? targets : ["page"], to, { left: ax, top: ay + 8 });
  };

  const shape = ({ kind, mark }, key, label, pending) => {
    const color = pending ? "#2745D6" : "#C2361B";
    const common = { stroke: color, strokeWidth: 2.5, fill: "none", vectorEffect: "non-scaling-stroke" };
    let body, lp;
    if (kind === "region") {
      const [a, b] = [toBox(mark.from), toBox(mark.to)];
      body = <rect x={Math.min(a[0], b[0])} y={Math.min(a[1], b[1])} width={Math.abs(a[0] - b[0])} height={Math.abs(a[1] - b[1])} {...common} strokeDasharray="6 4" fill={`${color}14`} />;
      lp = [Math.min(a[0], b[0]), Math.min(a[1], b[1])];
    } else if (kind === "draw") {
      body = mark.strokes.map((st, i) => <polyline key={i} points={st.map((p) => toBox(p).join(",")).join(" ")} {...common} strokeLinecap="round" strokeLinejoin="round" />);
      lp = toBox(mark.strokes[0][0]);
    } else {
      const [a, b] = [toBox(mark.from), toBox(mark.to)];
      body = <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...common} markerEnd={`url(#ml-head-${pending ? "p" : "n"})`} />;
      lp = a;
    }
    return (
      <g key={key}>
        {body}
        {label && (
          <g transform={`translate(${lp[0] - 12},${lp[1] - 12})`}>
            <rect width={Math.max(24, label.length * 8 + 12)} height="24" rx="12" fill={color} />
            <text x={Math.max(24, label.length * 8 + 12) / 2} y="16.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{label}</text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className={`ml${tool ? " is-active" : ""}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drawing.current = null; setLive(null); }}
      aria-hidden="true">
      <svg width="100%" height="100%">
        <defs>
          {[["n", "#C2361B"], ["p", "#2745D6"]].map(([k, c]) => (
            <marker key={k} id={`ml-head-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={c} />
            </marker>
          ))}
        </defs>
        {marks.map((m) => shape(m, m.no, m.no, false))}
        {draft && shape(draft, "draft", null, true)}
        {live && shape(live, "live", null, true)}
      </svg>
    </div>
  );
}
