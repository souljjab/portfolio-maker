/**
 * 시각 카드용 미니 썸네일 — grammar마다 첫 화면 한 장면만 고정 크기로 그린다.
 * 50ms 인상 판단용이라 사용자 콘텐츠 대신 고정 예시 문구를 쓴다.
 * 모든 크기는 카드 폭 기준(cqi)이라 어떤 크기로 놓아도 같은 장면이 된다.
 * 7종 템플릿을 새로 만들 때 이 장면이 설계 스케치 역할도 한다.
 */
import { grammarById } from "../data/grammars.js";
import "./thumbnails.css";

const NAME = "한결";
const LINE = "매일 쓰는 도구를 만듭니다";

/** 제목 대신 쓰는 회색 막대(글줄 흉내) */
const Bar = ({ w, className = "" }) => <i className={`th-bar ${className}`} style={{ width: `${w}%` }} />;

const SCENES = {
  "quiet-editorial": () => (
    <div className="th-qe">
      <p className="th-qe-top"><span>{NAME}</span></p>
      <p className="th-qe-h">사람들이 매일 쓰는<br />도구를 만듭니다</p>
      <ul>
        {["2026", "2025", "2024"].map((y, i) => (
          <li key={y}><span>{y}</span><Bar w={[62, 48, 55][i]} /></li>
        ))}
      </ul>
    </div>
  ),
  "warm-minimal": () => (
    <div className="th-wm">
      <i className="th-wm-avatar" />
      <p className="th-wm-name">{NAME}</p>
      <p className="th-wm-line">{LINE}</p>
      <span className="th-wm-btn">연락하기</span>
      <div className="th-wm-cards"><i /><i /></div>
    </div>
  ),
  swiss: () => (
    <div className="th-sw">
      <p className="th-sw-name">{NAME}</p>
      <i className="th-sw-sq" />
      <div className="th-sw-cols">
        {["01", "02", "03"].map((n, i) => (
          <div key={n}><b>{n}</b><Bar w={90} /><Bar w={[70, 80, 60][i]} /><Bar w={[50, 40, 65][i]} /></div>
        ))}
      </div>
    </div>
  ),
  "bold-type": () => (
    <div className="th-bt">
      <p className="th-bt-meta"><span>포트폴리오 2026</span><span>03</span></p>
      <p className="th-bt-name">{NAME}</p>
      <p className="th-bt-line">{LINE}</p>
      <p className="th-bt-idx">01</p>
    </div>
  ),
  bento: () => (
    <div className="th-bn">
      <div className="th-bn-a"><b>{NAME}</b><Bar w={70} /><Bar w={50} /></div>
      <div className="th-bn-b" />
      <div className="th-bn-c"><b>12</b><span>프로젝트</span></div>
      <div className="th-bn-d" />
      <div className="th-bn-e"><Bar w={80} /><Bar w={55} /></div>
    </div>
  ),
  gallery: () => (
    <div className="th-gl">
      <div className="th-gl-img"><i className="th-gl-sun" /><i className="th-gl-hill" /></div>
      <p className="th-gl-cap"><span>01 — 봄의 산책</span><span>{NAME}</span></p>
    </div>
  ),
  technical: () => (
    <div className="th-tc">
      <p className="th-tc-top"><span>{NAME}</span><span>2024–2026</span></p>
      <div className="th-tc-grid">
        <div className="th-tc-hero"><b>{NAME}</b><Bar w={75} /></div>
        <div className="th-tc-spec">{[60, 45, 70].map((w, i) => <p key={i}><span>0{i + 1}</span><Bar w={w} /></p>)}</div>
        {["P-01", "P-02", "P-03"].map((c) => (
          <div key={c} className="th-tc-cell"><span className="th-tc-code">{c}</span><Bar w={80} /><Bar w={55} /></div>
        ))}
      </div>
    </div>
  ),
  "retro-web": () => (
    <div className="th-rw">
      <div className="th-rw-win">
        <p className="th-rw-title">★ {NAME}의 홈페이지 ★</p>
        <div className="th-rw-body">
          <p><u>작업실</u> · <u>방명록</u> · <u>링크</u></p>
          <p className="th-rw-new">NEW! 새 프로젝트 올렸어요</p>
          <p className="th-rw-count">방문자 <span>000123</span></p>
        </div>
      </div>
    </div>
  ),
  organic: () => (
    <div className="th-og">
      <i className="th-og-blob1" />
      <i className="th-og-blob2" />
      <p className="th-og-name">{NAME}</p>
      <p className="th-og-line">{LINE}</p>
      <span className="th-og-pill">작업 보기</span>
    </div>
  ),
  experimental: () => (
    <div className="th-ex">
      <i className="th-ex-shape" />
      <p className="th-ex-name">{NAME}</p>
      <p className="th-ex-side">스크롤해 보세요 ↓</p>
      <p className="th-ex-small">{LINE}</p>
    </div>
  ),
};

export default function Thumbnail({ grammarId, className = "" }) {
  const Scene = SCENES[grammarId];
  const g = grammarById[grammarId];
  if (!Scene || !g) return null;
  return (
    <div className={`th ${className}`} role="img" aria-label={g.looks}>
      <div aria-hidden="true" className="th-inner"><Scene /></div>
    </div>
  );
}
