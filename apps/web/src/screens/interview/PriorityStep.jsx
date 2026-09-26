import { useState } from "react";
import { suggestContentOrder } from "../../engine/interview.js";
import { CONTENT_SECTIONS } from "../../data/interviewOptions.js";
import StepActions from "./StepActions.jsx";

const byId = Object.fromEntries(CONTENT_SECTIONS.map((s) => [s.id, s]));

/**
 * 5단계: 첫 화면 다음에 보여줄 순서. 드래그 대신 위·아래 버튼(키보드로 조작 가능).
 * 끝에 닿은 버튼은 disabled 대신 aria-disabled로 두어 focus가 사라지지 않게 한다.
 * value.order: 섹션 id 배열
 */
export default function PriorityStep({ value, baseDna, onSubmit, onBack }) {
  const suggested = suggestContentOrder(baseDna.goal);
  const [order, setOrder] = useState(value?.order ?? suggested);
  const [announce, setAnnounce] = useState("");

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    setAnnounce(`${byId[order[i]].label}: ${j + 2}번째로 옮겼어요.`); // 화면 번호는 첫 화면이 1번
  };
  const submit = (e) => { e.preventDefault(); onSubmit({ order }); };

  return (
    <form className="iv-form" onSubmit={submit}>
      {!value && <p className="iv-meta iv-left">‘{baseDna.goal.primaryGoal || "목적"}’에 맞춰 순서를 먼저 제안해 뒀어요.</p>}
      <ol className="iv-order">
        <li className="iv-order-item is-fixed">
          <span className="iv-order-num">1</span>
          <span><b>첫 화면</b><small>이름과 한 줄 소개 · 항상 맨 위</small></span>
        </li>
        {order.map((id, i) => (
          <li key={id} className="iv-order-item">
            <span className="iv-order-num">{i + 2}</span>
            <span><b>{byId[id].label}</b><small>{byId[id].hint}</small></span>
            <span className="iv-order-btns">
              <button type="button" className="iv-btn iv-btn-quiet" aria-label={`${byId[id].label} 위로`}
                aria-disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="iv-btn iv-btn-quiet" aria-label={`${byId[id].label} 아래로`}
                aria-disabled={i === order.length - 1} onClick={() => move(i, 1)}>↓</button>
            </span>
          </li>
        ))}
      </ol>
      <p className="iv-sr" aria-live="polite">{announce}</p>
      <StepActions onBack={onBack} />
    </form>
  );
}
