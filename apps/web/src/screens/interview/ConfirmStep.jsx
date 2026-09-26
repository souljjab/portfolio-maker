import { useState } from "react";
import { describeDirection } from "../../engine/taste.js";
import ChipPicker from "./ChipPicker.jsx";
import StepActions from "./StepActions.jsx";

const YES = "맞아요", NO = "아니에요", MIDDLE = "어느 쪽도 아니에요";

/**
 * 8단계: "제가 이해한 방향" 문장마다 맞아요/아니에요.
 * 축 문장에 "아니에요"면 반대쪽인지 중간인지 한 번 더 묻는다.
 * 피하고 싶은 인상에 "맞아요"면 hard 제약이 된다.
 * value.responses: { [문장 id]: "yes" | "no" | "no-opposite" | "no-middle" }
 */
export default function ConfirmStep({ value, baseDna, onSubmit, onBack }) {
  const statements = describeDirection(baseDna);
  const [responses, setResponses] = useState(value?.responses ?? {});
  const [error, setError] = useState("");
  const set = (id, v) => { setResponses((r) => ({ ...r, [id]: v })); setError(""); };

  const submit = (e) => {
    e.preventDefault();
    const pending = statements.find((s) => {
      const r = responses[s.id];
      return !r || (s.type === "axis" && r === "no");
    });
    if (pending) return setError("모든 문장에 답해 주세요. '아니에요'를 고른 문장은 어느 쪽인지도 골라 주세요.");
    // 지금 문장에 해당하는 답만 저장 (앞 단계가 바뀌어 사라진 문장의 답은 버림)
    onSubmit({ responses: Object.fromEntries(statements.map((s) => [s.id, responses[s.id]])) });
  };

  if (!statements.length) {
    return (
      <form className="iv-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ responses: {} }); }}>
        <p className="iv-done-note">아직 확실하게 말씀드릴 만한 게 없어요. 시안을 보면서 함께 맞춰 갈게요.</p>
        <StepActions onBack={onBack} />
      </form>
    );
  }

  return (
    <form className="iv-form" onSubmit={submit} noValidate>
      {statements.map((s) => {
        const r = responses[s.id];
        const top = !r ? [] : r === "yes" ? [YES] : [NO];
        return (
          <div key={s.id} className="iv-statement">
            <ChipPicker
              legend={s.text}
              options={[YES, NO]}
              single
              selected={top}
              onChange={([v]) => set(s.id, v === YES ? "yes" : "no")}
            />
            {s.type === "axis" && r && r !== "yes" && (
              <ChipPicker
                legend="그럼 어느 쪽에 가까운가요?"
                options={[`${s.opposite} 쪽`, MIDDLE]}
                single
                selected={r === "no-opposite" ? [`${s.opposite} 쪽`] : r === "no-middle" ? [MIDDLE] : []}
                onChange={([v]) => set(s.id, v === MIDDLE ? "no-middle" : "no-opposite")}
              />
            )}
          </div>
        );
      })}
      <StepActions onBack={onBack} error={error} submitLabel="이대로 정리하기" />
    </form>
  );
}
