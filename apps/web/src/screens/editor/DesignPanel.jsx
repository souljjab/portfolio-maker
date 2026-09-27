import { GRAMMAR_TOKENS } from "../../data/grammarTokens.js";
import { ensureContrast } from "../../engine/directions.js";
import { tokenEdits } from "../../engine/edits.js";
import { mix, hexToHsl } from "../../engine/color.js";
import { luminance } from "../../engine/contrast.js";
import ChipPicker from "../interview/ChipPicker.jsx";
import { FONTS, BODY_FONT_IDS } from "../../templates/fonts.js";
import { ADDONS, addonProblem } from "../../templates/addons.js";
import { MOOD_PRESETS } from "../../data/moodPresets.js";

/** 강조색 견본: grammar 기본 토큰의 강조색들 (모두 대비 게이트를 통과한 색) */
const ACCENTS = [...new Set(Object.values(GRAMMAR_TOKENS).map((t) => t.color.accent))];
const TONES = { origin: "원래대로", light: "더 밝게", warm: "따뜻하게", cool: "차갑게" };
const TINT = { light: ["#FFFFFF", 0.6, 0.6], warm: ["#F3E2C4", 0.45, 0.3], cool: ["#D8E3EE", 0.45, 0.3] }; // [섞을 색, 배경 비율, 카드 비율]
const MOTION = { none: "없음", subtle: "은은하게", expressive: "생동감 있게" };
const FONT_LABEL = Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, f.label]));
const byLabel = (map, label) => Object.keys(map).find((k) => map[k] === label);

/** 스크린리더용 색 이름 ("파랑 계열, 진한") — 색 코드만 읽어 주면 뜻이 없으므로 */
function colorName(hex) {
  const [h, s, l] = hexToHsl(hex);
  const tone = l < 35 ? "진한 " : l > 70 ? "연한 " : "";
  if (s < 12) return `${tone}회색`;
  const names = [[15, "빨강"], [40, "주황"], [65, "노랑"], [160, "초록"], [195, "청록"], [250, "파랑"], [290, "보라"], [335, "분홍"], [360, "빨강"]];
  return `${tone}${names.find(([max]) => h <= max)[1]}`;
}

function toneBg(origin, k) {
  if (k === "origin") return [origin.color.bg, origin.color.surface];
  const [tint, bg, surface] = TINT[k];
  return [mix(origin.color.bg, tint, bg), mix(origin.color.surface, tint, surface)];
}

/** 이름이 붙은 범위 조절 (양 끝에 뜻을 적어 숫자 몰라도 쓸 수 있게) */
function Range({ id, label, min, max, step, value, onChange, low, high, valueText }) {
  return (
    <div className="ed-range">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        aria-valuetext={valueText} onChange={(e) => onChange(Number(e.target.value))} />
      <div className="ed-range-ends" aria-hidden="true"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

/**
 * 디자인 다듬기: 고른 안의 토큰을 조금씩 바꾸고 개성 포인트를 얹는다. 배치(템플릿)는 그대로.
 * 모든 변경은 대비 게이트(ensureContrast)를 다시 거친다 — 자동 보정되면 알리고, 불가능하면 적용하지 않는다.
 * @param {{ tokens, origin, onChange: (tokens, note: string) => void }} props
 */
export default function DesignPanel({ tokens, origin, onChange }) {
  const lightBg = luminance(origin.color.bg) > 0.4; // 어두운 배경 디자인은 톤 조절을 막는다(대비가 깨지기 쉬움)
  const edits = tokenEdits(origin, tokens);

  const apply = (fn) => {
    const t = structuredClone(tokens);
    fn(t);
    const fixed = ensureContrast(t);
    if (!fixed) { onChange(tokens, "이 조합은 글자가 잘 안 읽혀서 적용하지 않았어요."); return; }
    const adjusted = JSON.stringify(fixed.color) !== JSON.stringify(t.color);
    onChange(fixed, adjusted ? "읽기 쉽도록 색을 조금 조정했어요." : "");
  };

  // 첫 견본은 고른 안의 원래 강조색 (3안 강조색은 취향에 맞춰 조정된 색이라 기본 견본에 없을 수 있음)
  const swatches = [...new Set([origin.color.accent, ...ACCENTS])];
  const tone = Object.keys(TONES).find((k) => toneBg(origin, k)[0] === tokens.color.bg);
  const preset = MOOD_PRESETS.find((p) => p.color.bg === tokens.color.bg && p.color.text === tokens.color.text);
  const addons = tokens.addons ?? [];
  const toggleAddon = (id) => apply((t) => {
    t.addons = addons.includes(id) ? addons.filter((x) => x !== id) : [...addons, id];
  });
  const setAccent = (hex) => apply((t) => {
    t.color.accent = hex.toUpperCase();
    t.color.onAccent = luminance(hex) > 0.18 ? "#111111" : "#FFFFFF";
  });

  return (
    <div className="ed-design">
      <ChipPicker legend="분위기 프리셋 (색·글꼴·모서리를 한 번에)" options={MOOD_PRESETS.map((p) => p.label)} single
        selected={preset ? [preset.label] : []}
        onChange={([l]) => apply((t) => {
          const p = MOOD_PRESETS.find((x) => x.label === l);
          t.color = { ...p.color };
          t.type.display = p.type.display;
          t.type.body = p.type.body;
          t.radius = { lg: p.radius, sm: Math.round(p.radius * 0.4) };
        })} />

      <fieldset className="iv-field">
        <legend>강조색</legend>
        <div className="ed-swatches">
          {swatches.map((hex, i) => (
            <label key={hex} className={`ed-swatch${i === 0 ? " is-origin" : ""}`} style={{ "--sw": hex }}>
              <input type="radio" name="ed-accent" checked={tokens.color.accent === hex} onChange={() => setAccent(hex)} />
              <span className="iv-sr">{i === 0 ? "고른 안의 색, " : ""}{colorName(hex)} {hex}</span>
            </label>
          ))}
          <label className="ed-swatch-custom">
            직접 고르기
            <input type="color" value={tokens.color.accent.toLowerCase()} onChange={(e) => setAccent(e.target.value)} />
          </label>
        </div>
      </fieldset>

      {lightBg && (
        <ChipPicker legend="배경 톤" options={Object.values(TONES)} single selected={tone ? [TONES[tone]] : []}
          onChange={([l]) => apply((t) => { [t.color.bg, t.color.surface] = toneBg(origin, byLabel(TONES, l)); })} />
      )}

      <ChipPicker legend="제목 글꼴" options={Object.values(FONT_LABEL)} single selected={[FONT_LABEL[tokens.type.display]]}
        onChange={([l]) => apply((t) => { t.type.display = byLabel(FONT_LABEL, l); })} />
      <ChipPicker legend="본문 글꼴" options={BODY_FONT_IDS.map((k) => FONT_LABEL[k])} single selected={[FONT_LABEL[tokens.type.body]]}
        onChange={([l]) => apply((t) => { t.type.body = byLabel(FONT_LABEL, l); })} />

      <Range id="ed-scale" label="글자 크기 차이" min={1.125} max={1.618} step={0.025} value={tokens.type.scaleRatio}
        low="차분하게" high="극적으로" valueText={`${Math.round(((tokens.type.scaleRatio - 1.125) / 0.493) * 100)}%`}
        onChange={(v) => apply((t) => { t.type.scaleRatio = +v.toFixed(3); })} />
      <Range id="ed-space" label="여백" min={48} max={200} step={8} value={tokens.space.section}
        low="촘촘하게" high="넉넉하게" valueText={`섹션 간격 ${tokens.space.section}px`}
        onChange={(v) => apply((t) => { t.space.section = v; })} />
      <Range id="ed-radius" label="모서리" min={0} max={48} step={2} value={tokens.radius.lg}
        low="각지게" high="둥글게" valueText={`${tokens.radius.lg}px`}
        onChange={(v) => apply((t) => { t.radius.lg = v; t.radius.sm = Math.round(v * 0.4); })} />

      <ChipPicker legend="움직임" options={Object.values(MOTION)} single selected={[MOTION[tokens.motion.level]]}
        onChange={([l]) => apply((t) => { t.motion.level = byLabel(MOTION, l); })} />

      <fieldset className="iv-field">
        <legend>개성 포인트</legend>
        <ul className="ed-addons">
          {ADDONS.map((a) => {
            const problem = addonProblem(a.id, tokens);
            const on = addons.includes(a.id);
            return (
              <li key={a.id}>
                <label className="ed-addon">
                  <input type="checkbox" checked={on} disabled={Boolean(problem) && !on} aria-describedby={`ed-addon-${a.id}`}
                    onChange={() => toggleAddon(a.id)} />
                  <span className="ed-addon-name">{a.label}</span>
                </label>
                <p id={`ed-addon-${a.id}`} className="iv-meta iv-left ed-addon-desc">
                  {a.desc}{problem ? ` — ${problem}${on ? " 지금은 꺼진 것처럼 보여요." : ""}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="ed-design-foot">
        <p className="iv-meta iv-left">고른 안에서 바꾼 곳: {edits.length}군데. 바꾼 내용은 다음 추천에 반영돼요.</p>
        <button type="button" className="iv-btn iv-btn-quiet" disabled={!edits.length}
          onClick={() => onChange(structuredClone(origin), "고른 안 그대로 되돌렸어요.")}>고른 안으로 되돌리기</button>
      </div>
    </div>
  );
}
