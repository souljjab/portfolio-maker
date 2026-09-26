import Thumbnail from "../thumbnails/Thumbnail.jsx";

/** 같은 내용이 세 가지 방향으로 달라지는 모습 (가운데가 추천안) */
const SHOWCASE = [
  { grammar: "warm-minimal", label: "익숙한 안" },
  { grammar: "quiet-editorial", label: "추천안" },
  { grammar: "bold-type", label: "한 걸음 더" },
];

export default function LandingVisual() {
  return (
    <ul className="lp-fan">
      {SHOWCASE.map((s) => (
        <li key={s.grammar} className={`lp-fan-item is-${s.grammar}`}>
          <Thumbnail grammarId={s.grammar} />
          <span className="lp-fan-label">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}
