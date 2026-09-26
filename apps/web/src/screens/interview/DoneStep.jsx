import { useEffect, useMemo, useState } from "react";
import { loadDraft } from "../../api/index.js";
import { grammarById } from "../../data/grammars.js";
import { CONTENT_SECTIONS, DIRECTION_KINDS } from "../../data/interviewOptions.js";
import PreviewFrame from "../directions/PreviewFrame.jsx";
import { useResolvedPortfolio } from "../useResolvedPortfolio.js";

/**
 * 마지막 화면: 고른 안(초안으로 저장된 것)을 크게 보여주고, 인터뷰에서 이해한 내용을 요약.
 * 여기서 편집기(내용 채우기)로 넘어간다.
 */
export default function DoneStep({ session, onBack, onReset, onOpenEditor }) {
  const [draft, setDraft] = useState(null);
  const [render, setRender] = useState(null); // 정적 렌더러는 무거워서 필요할 때만 불러온다
  const [device, setDevice] = useState("desktop");
  useEffect(() => {
    Promise.all([loadDraft(), import("../../templates/renderHtml.js")]).then(([d, mod]) => {
      setDraft(d);
      setRender(() => mod.renderPortfolioHtml);
    });
  }, []);

  const drawable = useResolvedPortfolio(draft);
  const html = useMemo(() => (drawable?.tokens && drawable.template && render
    ? render({ portfolio: drawable, tokens: drawable.tokens, template: drawable.template, preview: true })
    : null), [drawable, render]);

  const { identity, goal, constraints } = session.dna;
  const choice = session.answers.directions;
  const label = (id) => CONTENT_SECTIONS.find((s) => s.id === id)?.label ?? id;
  const rows = [
    ["고른 안", choice ? `${DIRECTION_KINDS[choice.kind].label} (${grammarById[choice.grammar].name})` : "—"],
    ["좋았던 점", choice?.reasons.join(", ") || "—"],
    ["목적", goal.primaryGoal],
    ["주로 보는 사람", goal.audience],
    ["기억되고 싶은 인상", identity.traitsTarget.join(", ")],
    ["꼭 지킬 것", constraints.hard.map((h) => h.statement).join(", ") || "없음"],
    ["보여줄 순서", (goal.contentPriority ?? []).map(label).join(" > ") || "—"],
  ];

  return (
    <div className="iv-form">
      <div className="iv-done-note iv-done-cta">
        <p>고른 안을 초안으로 저장했어요. 이제 예시 작업을 내 작업과 소개로 바꿔 볼까요?</p>
        {onOpenEditor && <button type="button" className="iv-btn iv-btn-primary" onClick={onOpenEditor}>내용 채우기</button>}
      </div>
      {html && (
        <>
          <div className="dr-seg" role="group" aria-label="화면 크기">
            {[["desktop", "데스크톱"], ["mobile", "모바일"]].map(([k, t]) => (
              <button key={k} type="button" aria-pressed={device === k} onClick={() => setDevice(k)}>{t}</button>
            ))}
          </div>
          <PreviewFrame key={device} mode="full" device={device} html={html} title="고른 안 미리보기" />
        </>
      )}
      <dl className="iv-summary">
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>
        ))}
      </dl>
      <div className="iv-actions-row">
        <button type="button" className="iv-btn iv-btn-quiet" onClick={onBack}>세 안 다시 보기</button>
        <button type="button" className="iv-btn iv-btn-quiet" onClick={onReset}>처음부터 다시</button>
      </div>
    </div>
  );
}
