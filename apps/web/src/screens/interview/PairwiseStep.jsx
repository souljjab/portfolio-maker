import { useState } from "react";
import { applyPairwiseChoices, pickPairwiseQuestion, MAX_PAIRWISE } from "../../engine/taste.js";
import { grammarById } from "../../data/grammars.js";
import Thumbnail from "../../thumbnails/Thumbnail.jsx";
import StepActions from "./StepActions.jsx";

/**
 * 7단계: 카드로도 분명해지지 않은 축만 골라 두 안 중 하나를 고르게 한다(최대 4번).
 * value.choices: [{ axis, a, b, winner }] — winner가 null이면 "잘 모르겠어요"
 */
export default function PairwiseStep({ value, baseDna, onSubmit, onBack }) {
  const [choices, setChoices] = useState(value?.choices ?? []);
  const q = pickPairwiseQuestion(applyPairwiseChoices(baseDna, choices), choices);
  // 좌우 위치 편향을 줄이려고 질문마다 순서를 번갈아 둔다
  const sides = q ? (choices.length % 2 ? [q.b, q.a] : [q.a, q.b]) : [];

  const choose = (winner) => setChoices((cs) => [...cs, { ...q, winner }]);
  const undo = () => setChoices((cs) => cs.slice(0, -1));
  const submit = (e) => { e.preventDefault(); onSubmit({ choices }); };

  return (
    <form className="iv-form" onSubmit={submit}>
      <p className="iv-sr" aria-live="polite">
        {q ? `비교 ${choices.length + 1}: ${sides.map((id) => grammarById[id].blurb).join(" 또는 ")}` : "비교가 끝났어요."}
      </p>

      {q ? (
        <>
          <p className="iv-meta iv-left">{choices.length + 1}번째 비교 (최대 {MAX_PAIRWISE}번)</p>
          <div className="iv-pair" role="group" aria-label="둘 중 더 끌리는 쪽">
            {sides.map((id, i) => (
              <button key={id} type="button" className="iv-pick" onClick={() => choose(id)}>
                <Thumbnail grammarId={id} />
                <span className="iv-pick-label"><b>{i === 0 ? "왼쪽" : "오른쪽"}</b> {grammarById[id].blurb}</span>
              </button>
            ))}
          </div>
          <div className="iv-actions-row">
            {onBack && <button type="button" className="iv-btn iv-btn-quiet" onClick={onBack}>이전</button>}
            <span className="iv-row-gap">
              <button type="button" className="iv-btn iv-btn-quiet" onClick={undo} disabled={!choices.length}>되돌리기</button>
              <button type="button" className="iv-btn iv-btn-quiet" onClick={() => choose(null)}>잘 모르겠어요</button>
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="iv-done-note">
            {choices.length
              ? `${choices.length}번 비교로 헷갈리던 부분이 정리됐어요.`
              : "카드만으로도 충분히 분명해서 비교할 게 없어요."}
          </p>
          {choices.length > 0 && (
            <div className="iv-actions-row">
              <button type="button" className="iv-btn iv-btn-quiet" onClick={undo}>마지막 비교 다시 하기</button>
            </div>
          )}
          <StepActions onBack={onBack} />
        </>
      )}
    </form>
  );
}
