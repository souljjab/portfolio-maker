import { useEffect, useRef, useState } from "react";

/**
 * 정적 HTML 미리보기 (iframe srcdoc, 스크립트 불가 샌드박스).
 * thumb: 가상 화면(width×height)을 그대로 그린 뒤 상자 폭에 맞춰 축소 — 템플릿의 컨테이너 쿼리가
 *        실제 데스크톱 폭 기준으로 동작한다. 조작·focus가 안 되도록 inert 처리(카드의 버튼으로 조작).
 * full: 실제 폭(또는 모바일 폭)으로 스크롤해서 보는 미리보기.
 */
export default function PreviewFrame({ html, title, mode = "full", width = 1280, height = 800, device = "desktop" }) {
  const boxRef = useRef(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    if (mode !== "thumb" || !boxRef.current) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [mode, width]);

  if (mode === "thumb") {
    return (
      <div ref={boxRef} className="pv-thumb" style={{ aspectRatio: `${width} / ${height}` }} inert>
        <iframe
          srcDoc={html}
          title={title}
          sandbox=""
          scrolling="no" /* 축소 미리보기에 스크롤바가 보이지 않게 */
          style={{ width, height, transform: `scale(${scale})` }}
        />
      </div>
    );
  }

  return (
    <div className={`pv-full is-${device}`}>
      <iframe srcDoc={html} title={title} sandbox="allow-popups allow-popups-to-escape-sandbox" />
    </div>
  );
}
