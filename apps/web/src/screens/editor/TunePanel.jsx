import { useId } from "react";
import { TUNE, tuneValue, tuneSupported, knobsFor } from "../../templates/tune.js";

/** 기존 토큰 중 영역 조절에 함께 보여 줄 것 */
const TOKEN_KNOBS = {
  "type.scaleRatio": { label: "제목과 본문 크기 차이", min: 1.125, max: 1.618, step: 0.025, low: "차분하게", high: "극적으로", get: (t) => t.type.scaleRatio },
  "radius.lg": { label: "모서리", min: 0, max: 48, step: 2, low: "각지게", high: "둥글게", get: (t) => t.radius.lg },
  "space.section": { label: "섹션 사이 여백", min: 48, max: 200, step: 8, low: "촘촘하게", high: "넉넉하게", get: (t) => t.space.section },
};

/**
 * 맞춤 슬라이더: 캔버스에서 누른 곳(field)에 맞는 조절만 보여 준다(templates/tune.js의 knobsFor).
 * tune 값은 미리보기에 바로 반영(onLive)하고 초안에도 저장(onChange). 모든 값은 토큰 범위 안에서만.
 * @param {{ field: string, template: string, tokens, onChange: (path, value) => void, onLive: (cssVar, value) => void }} props
 */
export default function TunePanel({ field, template, tokens, onChange, onLive }) {
  const id = useId();
  const k = knobsFor(field);
  const tune = k.tune.filter((key) => tuneSupported(key, template));
  const pct = (v, min, max) => `${Math.round(((v - min) / (max - min)) * 100)}%`;

  const slider = (key, knob, value, onInput) => (
    <div key={key} className="ed-range">
      <label htmlFor={`${id}-${key}`}>{knob.label}</label>
      <input id={`${id}-${key}`} type="range" min={knob.min} max={knob.max} step={knob.step} value={value}
        aria-valuetext={pct(value, knob.min, knob.max)} onChange={(e) => onInput(Number(e.target.value))} />
      <div className="ed-range-ends" aria-hidden="true"><span>{knob.low}</span><span>{knob.high}</span></div>
    </div>
  );

  return (
    <div className="tp" role="group" aria-labelledby={`${id}-h`}>
      <p id={`${id}-h`} className="tp-h">조절: <strong>{k.title}</strong></p>
      <div className="tp-knobs">
        {tune.map((key) => slider(key, TUNE[key], tuneValue(tokens, key), (v) => { onLive(TUNE[key].css, v); onChange(`tune.${key}`, v); }))}
        {k.token.map((path) => slider(path, TOKEN_KNOBS[path], TOKEN_KNOBS[path].get(tokens), (v) => onChange(path, v)))}
      </div>
      {tune.length === 0 && k.token.length === 0 && <p className="iv-meta iv-left">이 부분은 조절할 값이 없어요.</p>}
    </div>
  );
}
