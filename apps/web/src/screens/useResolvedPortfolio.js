import { useEffect, useState } from "react";
import { resolveImages } from "../api/index.js";

/**
 * 초안(이미지 참조 img:…)을 그리기용 사본으로 바꿔 돌려준다. 미리보기·내려받기에만 쓰고 저장하지 않는다.
 * 풀기 전(또는 portfolio가 없으면) null.
 */
export function useResolvedPortfolio(portfolio) {
  const [resolved, setResolved] = useState(null);
  useEffect(() => {
    if (!portfolio) return;
    let alive = true;
    resolveImages(portfolio).then((r) => { if (alive) setResolved(r); });
    return () => { alive = false; };
  }, [portfolio]);
  return resolved;
}
