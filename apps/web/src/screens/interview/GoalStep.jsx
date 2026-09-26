import { useState } from "react";
import { PRIMARY_GOALS, AUDIENCES, CONVERSIONS } from "../../data/interviewOptions.js";
import ChipPicker from "./ChipPicker.jsx";
import StepActions from "./StepActions.jsx";

const FIELDS = [
  { key: "primaryGoal", legend: "가장 큰 목적", options: PRIMARY_GOALS },
  { key: "audience", legend: "주로 보는 사람", options: AUDIENCES },
  { key: "conversionGoal", legend: "다 본 사람이 해 줬으면 하는 일", options: CONVERSIONS },
];

/** 2단계: 목적·대상·전환 목표 (각각 하나씩, 직접 입력 가능) */
export default function GoalStep({ value, onSubmit, onBack }) {
  const [goal, setGoal] = useState({ primaryGoal: "", audience: "", conversionGoal: "", ...value });
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const missing = FIELDS.find((f) => !goal[f.key]);
    if (missing) return setError(`'${missing.legend}'을(를) 골라 주세요.`);
    onSubmit(goal);
  };

  return (
    <form className="iv-form" onSubmit={submit} noValidate>
      {FIELDS.map((f) => (
        <ChipPicker
          key={f.key}
          legend={f.legend}
          options={f.options}
          single
          customLabel="직접 입력"
          selected={goal[f.key] ? [goal[f.key]] : []}
          onChange={([v]) => { setGoal((g) => ({ ...g, [f.key]: v })); setError(""); }}
        />
      ))}
      <StepActions onBack={onBack} error={error} />
    </form>
  );
}
