import { useState } from "react";
import { TARGET_TRAITS, AVOID_TRAITS, NO_AVOID, MAX_TRAITS } from "../../data/interviewOptions.js";
import ChipPicker from "./ChipPicker.jsx";
import StepActions from "./StepActions.jsx";

/** 3단계: 기억되고 싶은 인상(1~3개) + 피하고 싶은 인상(1~3개 또는 '딱히 없어요') */
export default function TraitsStep({ value, onSubmit, onBack }) {
  const [target, setTarget] = useState(value?.target ?? []);
  const [avoid, setAvoid] = useState(value?.avoid ?? []);
  const [noAvoid, setNoAvoid] = useState(value?.noAvoid ?? false);
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!target.length) return setError("기억되고 싶은 인상을 하나 이상 골라 주세요.");
    if (!avoid.length && !noAvoid) return setError(`피하고 싶은 인상을 고르거나 '${NO_AVOID}'를 선택해 주세요.`);
    onSubmit({ target, avoid: noAvoid ? [] : avoid, noAvoid });
  };

  return (
    <form className="iv-form" onSubmit={submit} noValidate>
      <ChipPicker
        legend="기억되고 싶은 인상"
        options={TARGET_TRAITS}
        max={MAX_TRAITS}
        customLabel="직접 입력"
        selected={target}
        onChange={(v) => { setTarget(v); setError(""); }}
      />
      <ChipPicker
        legend="피하고 싶은 인상"
        options={AVOID_TRAITS}
        max={MAX_TRAITS}
        customLabel="직접 입력"
        selected={noAvoid ? [] : avoid}
        disabled={noAvoid}
        onChange={(v) => { setAvoid(v); setError(""); }}
      />
      <label className="iv-chip iv-chip-solo">
        <input type="checkbox" checked={noAvoid} onChange={(e) => { setNoAvoid(e.target.checked); setError(""); }} />
        <span>{NO_AVOID}</span>
      </label>
      <StepActions onBack={onBack} error={error} />
    </form>
  );
}
