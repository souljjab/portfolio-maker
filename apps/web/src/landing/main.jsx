/**
 * 랜딩의 첫 화면 그림만 덧붙인다. 본문은 landing.html에 정적으로 있어서 스크립트가 없어도 페이지는 온전하다.
 */
import { createRoot } from "react-dom/client";
import LandingVisual from "./LandingVisual.jsx";

const el = document.getElementById("lp-visual");
if (el) createRoot(el).render(<LandingVisual />);
