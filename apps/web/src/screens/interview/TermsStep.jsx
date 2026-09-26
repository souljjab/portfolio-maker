import { useState } from "react";
import { findVagueTerms } from "../../engine/taste.js";
import { MAX_TERM_OPTIONS } from "../../data/vagueTerms.js";
import ChipPicker from "./ChipPicker.jsx";
import StepActions from "./StepActions.jsx";

const UNSURE = "잘 모르겠어요";

/**
 * 4단계: 앞에서 쓴 모호한 단어(깔끔한·세련된 등)를 화면에서 보이는 뜻으로 나눠 고르게 한다.
 * value.choices: { [단어 key]: 고른 뜻 id[] } — 빈 배열은 "잘 모르겠어요"
 * "잘 모르겠어요"는 개수 제한 밖의 별도 체크박스라 뜻을 2개 고른 상태에서도 바로 누를 수 있다.
 */
export default function TermsStep({ value, baseDna, onSubmit, onBack }) {
  const terms = findVagueTerms(baseDna);
  // 단어별 상태: 뜻 id 배열, 또는 null(아직 안 고름). 빈 배열 = 잘 모르겠어요
  const [choices, setChoices] = useState(() => Object.fromEntries(terms.map((t) => [t.key, value?.choices?.[t.key] ?? null])));
  const [error, setError] = useState("");
  const set = (key, ids) => { setChoices((c) => ({ ...c, [key]: ids })); setError(""); };

  const submit = (e) => {
    e.preventDefault();
    const pending = terms.find((t) => choices[t.key] === null);
    if (pending) return setError(`‘${pending.word}’에 대해 하나 이상 골라 주세요. 모르겠으면 '${UNSURE}'도 괜찮아요.`);
    onSubmit({ choices: Object.fromEntries(terms.map((t) => [t.key, choices[t.key]])) });
  };

  if (!terms.length) {
    return (
      <form className="iv-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ choices: {} }); }}>
        <p className="iv-done-note">앞에서 쓰신 말은 충분히 구체적이라 따로 여쭤볼 게 없어요.</p>
        <StepActions onBack={onBack} />
      </form>
    );
  }

  return (
    <form className="iv-form" onSubmit={submit} noValidate>
      {terms.map((t) => {
        const ids = choices[t.key];
        const unsure = Array.isArray(ids) && ids.length === 0;
        return (
          <div key={t.key} className="iv-statement">
            <ChipPicker
              legend={`‘${t.word}’이라고 하셨는데, 어떤 쪽에 가까운가요?`}
              options={t.options.map((o) => o.label)}
              max={MAX_TERM_OPTIONS}
              selected={(ids ?? []).map((id) => t.options.find((o) => o.id === id)?.label).filter(Boolean)}
              onChange={(labels) => set(t.key, labels.length ? labels.map((l) => t.options.find((o) => o.label === l).id) : null)}
            />
            <label className="iv-chip iv-chip-unsure">
              <input type="checkbox" checked={unsure} onChange={(e) => set(t.key, e.target.checked ? [] : null)} />
              <span>{UNSURE}</span>
            </label>
          </div>
        );
      })}
      <StepActions onBack={onBack} error={error} />
    </form>
  );
}
