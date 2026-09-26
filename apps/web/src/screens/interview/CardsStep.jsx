import { useState } from "react";
import { pickNextCard } from "../../engine/taste.js";
import { grammarById, CARD_ORDER } from "../../data/grammars.js";
import Thumbnail from "../../thumbnails/Thumbnail.jsx";
import { REACTION_LABEL } from "../../data/interviewOptions.js";
import StepActions from "./StepActions.jsx";

/**
 * 6단계: 시각 카드를 한 장씩 보여주고 좋아요/상관없어요/별로예요.
 * 연달아 별로인 카드와 아주 비슷한 카드는 엔진(pickNextCard)이 건너뛴다.
 * value.reactions: 본 순서대로의 반응 (건너뛴 카드는 reaction "skipped")
 */
export default function CardsStep({ value, onSubmit, onBack }) {
  const [reactions, setReactions] = useState(value?.reactions ?? []);
  const { next, skipped } = pickNextCard(reactions);
  const seen = reactions.filter((r) => r.reaction !== "skipped");
  const skippedCount = reactions.length - seen.length + skipped.length;
  const total = CARD_ORDER.length - skippedCount;

  const react = (reaction) => setReactions((rs) => [
    ...rs,
    ...skipped.map((id) => ({ id, reaction: "skipped" })),
    { id: next, reaction },
  ]);
  // 직전 반응과, 그 반응 때 함께 건너뛴 카드를 되돌린다
  const undo = () => setReactions((rs) => {
    const a = rs.slice(0, -1);
    while (a.at(-1)?.reaction === "skipped") a.pop();
    return a;
  });
  const submit = (e) => { e.preventDefault(); onSubmit({ reactions }); };

  return (
    <form className="iv-form" onSubmit={submit}>
      <p className="iv-sr" aria-live="polite">
        {next ? `카드 ${seen.length + 1}/${total}: ${grammarById[next].blurb}` : "카드를 모두 봤어요."}
      </p>

      {next ? (
        <>
          <div className="iv-card">
            <p className="iv-meta iv-card-count">{seen.length + 1} / {total}</p>
            <Thumbnail key={next} grammarId={next} className="iv-card-thumb" />
            <p className="iv-card-blurb">{grammarById[next].blurb}</p>
          </div>
          <div className="iv-react" role="group" aria-label="이 카드는 어떤가요?">
            {["dislike", "neutral", "like"].map((k) => (
              <button key={k} type="button" className={`iv-btn iv-react-${k}`} onClick={() => react(k)}>{REACTION_LABEL[k]}</button>
            ))}
          </div>
          <div className="iv-actions-row">
            {onBack && <button type="button" className="iv-btn iv-btn-quiet" onClick={onBack}>이전</button>}
            <button type="button" className="iv-btn iv-btn-quiet" onClick={undo} disabled={!seen.length}>되돌리기</button>
          </div>
        </>
      ) : (
        <>
          <ul className="iv-card-grid" aria-label="고른 결과">
            {seen.map((r) => (
              <li key={r.id} className={`iv-card-mini is-${r.reaction}`}>
                <Thumbnail grammarId={r.id} />
                <span className="iv-badge">{REACTION_LABEL[r.reaction]}</span>
              </li>
            ))}
          </ul>
          {skippedCount > 0 && <p className="iv-meta iv-left">별로라고 하신 카드와 아주 비슷한 {skippedCount}장은 건너뛰었어요.</p>}
          <div className="iv-actions-row">
            <button type="button" className="iv-btn iv-btn-quiet" onClick={undo}>마지막 카드 다시 보기</button>
            <button type="button" className="iv-btn iv-btn-quiet" onClick={() => setReactions([])}>처음부터 다시 고르기</button>
          </div>
          <StepActions onBack={onBack} />
        </>
      )}
    </form>
  );
}
