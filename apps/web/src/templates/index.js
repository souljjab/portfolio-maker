/**
 * grammar id → 템플릿 컴포넌트. 모든 템플릿은 ({ portfolio, tokens }) props만 받는다.
 * 아직 구현하지 않은 grammar는 null을 돌려준다.
 */
import QuietEditorial from "./QuietEditorial.jsx";
import BoldType from "./BoldType.jsx";
import Technical from "./Technical.jsx";
import WarmMinimal from "./WarmMinimal.jsx";
import Organic from "./Organic.jsx";
import Gallery from "./Gallery.jsx";

export const TEMPLATES = {
  "quiet-editorial": QuietEditorial,
  "bold-type": BoldType,
  technical: Technical,
  "warm-minimal": WarmMinimal,
  organic: Organic,
  gallery: Gallery,
};

export function getTemplate(grammarId) {
  return TEMPLATES[grammarId] ?? null;
}
