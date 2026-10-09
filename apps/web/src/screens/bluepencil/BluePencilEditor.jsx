/**
 * 블루펜슬 (Blue Pencil) — AI가 만든 포트폴리오 초안을 다듬는 교정 편집기
 *
 * Claude Design의 다듬기 흐름을 포트폴리오용으로 옮긴 React 단일 파일 컴포넌트입니다.
 *  - 표시하기: 요소 주석(C), 드래그 영역(R), 펜 그리기(P), 화살표(A) + 수정 메모 → Claude로 한 번에 반영
 *  - 직접 고치기: 글자 바로 편집(T), 요소 선택 후 크기·색·여백 조정, 복제·삭제·순서 변경
 *  - 조절하기: 디자인 토큰 슬라이더, 분위기 프리셋, 개성 포인트, Claude가 만드는 맞춤 노브
 *  - 대화로 고치기, 버전 기록(되돌리기), 데스크톱·태블릿·모바일 미리보기
 *  - 내보내기: HTML, Claude Code용 수정 요청서, 학습용 수정 기록(JSON)
 *
 * 이 프로젝트에 넣으면서 바꾼 것 (나머지는 원본 그대로)
 *  - Claude 호출은 aiCall(mode, prompt) prop으로 — 앱이 서버 /api/ai/pencil로 보낸다(키·사용량 제한·AI 끄기는 서버).
 *    지시문은 engine/pencilPrompts.js(서버가 mode로 고름), 모델은 서버 설정.
 *  - 화면 연결은 screens/bluepencil/Pencil.jsx (초안 ↔ HTML, 이미지 참조, 저장).
 *  - TOKEN_META에 이 프로젝트 템플릿 토큰의 한국어 이름을 더했다.
 *
 * props: initialHtml(초안 HTML), onChange({ html, annotations, editLog, doc }), aiCall
 */
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import {
  MousePointer2, MessageSquarePlus, SquareDashedMousePointer, PenLine, MoveUpRight, Type, Hand,
  Undo2, Redo2, Monitor, Tablet, Smartphone, ZoomIn, ZoomOut, Maximize2, Eye, EyeOff, Upload, Download,
  Sparkles, SlidersHorizontal, History, MessageSquare, Layers, X, Trash2, Copy, Send, Wand2, ThumbsUp,
  Loader2, ArrowUp, ArrowDown, CornerLeftUp, AlignLeft, AlignCenter, AlignRight, CopyPlus, CircleCheck,
  TriangleAlert, Highlighter, RotateCcw, PanelBottom, Pencil, Check,
} from "lucide-react";
import { OPS_SYSTEM, CHAT_SYSTEM, KNOB_SYSTEM } from "../../engine/pencilPrompts.js";

/* ─────────────────────────── 설정 ─────────────────────────── */

const STORAGE_KEY = "blue-pencil:session:v1";
const MAX_HISTORY = 80;
const KEEP_COLOR = "#1C8457";
const HIDDEN = { hidden: true };

const DEVICES = {
  desktop: { label: "데스크톱", w: 1280, Icon: Monitor },
  tablet: { label: "태블릿", w: 820, Icon: Tablet },
  mobile: { label: "모바일", w: 390, Icon: Smartphone },
};

const TOOLS = [
  { id: "select", label: "선택", key: "V", Icon: MousePointer2 },
  { id: "comment", label: "주석", key: "C", Icon: MessageSquarePlus },
  { id: "region", label: "영역", key: "R", Icon: SquareDashedMousePointer },
  { id: "draw", label: "펜", key: "P", Icon: PenLine },
  { id: "arrow", label: "화살표", key: "A", Icon: MoveUpRight },
  { id: "text", label: "글자", key: "T", Icon: Type },
  { id: "hand", label: "이동", key: "H", Icon: Hand },
];
const TOOL_HINTS = {
  select: "요소를 누르면 선택, 두 번 누르면 글자를 고쳐요",
  comment: "주석을 달 요소를 누르세요",
  region: "바꿀 영역을 드래그하세요",
  draw: "고칠 곳에 그어 보세요. 여러 번 그으면 한 메모로 묶여요",
  arrow: "옮길 요소에서 도착할 곳까지 끌어 주세요",
  text: "고칠 글자를 누르고 바로 입력하세요",
  hand: "끌어서 화면을 움직여요",
};
const MARK_TOOLS = ["region", "draw", "arrow"];

const TYPE_LABEL = { comment: "주석", region: "영역", draw: "펜 표시", arrow: "화살표" };
const TYPE_ICON = { comment: MessageSquarePlus, region: SquareDashedMousePointer, draw: PenLine, arrow: MoveUpRight };
const TYPE_DESC = {
  comment: "요소에 직접 단 주석",
  region: "드래그로 지정한 영역 (대상 요소 = 영역 안에 들어온 요소)",
  draw: "펜으로 그은 표시 (대상 요소 = 그린 범위 안의 요소)",
  arrow: "화살표 (시작 요소를 끝 위치로 옮기거나, 둘을 이어 달라는 뜻일 수 있음)",
};
const STATUS_LABEL = { open: "대기", applying: "반영 중", applied: "반영됨", failed: "실패", resolved: "해결", reverted: "되돌려짐" };

const CATEGORIES = [
  { id: "layout", label: "배치" }, { id: "spacing", label: "여백" }, { id: "type", label: "글자" },
  { id: "color", label: "색" }, { id: "image", label: "이미지" }, { id: "motion", label: "움직임" },
  { id: "copy", label: "문구" }, { id: "signature", label: "개성" },
];
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const SIGNATURE_IDEAS = [
  "손글씨 느낌의 한 줄 메모", "나를 상징하는 작은 기호나 모티프", "마우스를 올리면 살짝 반응",
  "종이나 필름 같은 질감", "형광펜으로 그은 듯한 강조", "예상 밖의 작은 인터랙션 하나",
];
const CHAT_SUGGESTIONS = [
  "전체 분위기를 조금 더 따뜻하게", "첫 화면 제목을 더 대담하게",
  "프로젝트 카드에 나만의 시그니처 요소 하나 추가", "문구를 더 짧고 자연스럽게",
  "모바일에서 여백과 글자 크기 정리",
];
const MARK_COLORS = [
  { id: "blue", value: "#2F4AE0", label: "파랑" },
  { id: "red", value: "#D0412A", label: "빨강" },
  { id: "amber", value: "#E39B00", label: "주황" },
  { id: "ink", value: "#1C1E21", label: "먹색" },
];

const FONT_OPTIONS = [
  { name: "Noto Sans KR", family: "'Noto Sans KR', sans-serif", q: "Noto+Sans+KR:wght@400;500;700;900", note: "담백한 고딕" },
  { name: "IBM Plex Sans KR", family: "'IBM Plex Sans KR', sans-serif", q: "IBM+Plex+Sans+KR:wght@400;500;600;700", note: "또렷한 고딕" },
  { name: "Gowun Dodum", family: "'Gowun Dodum', sans-serif", q: "Gowun+Dodum", note: "둥글고 다정한" },
  { name: "Nanum Myeongjo", family: "'Nanum Myeongjo', serif", q: "Nanum+Myeongjo:wght@400;700;800", note: "잡지 같은 명조" },
  { name: "Gowun Batang", family: "'Gowun Batang', serif", q: "Gowun+Batang:wght@400;700", note: "부드러운 바탕" },
  { name: "Hahmlet", family: "'Hahmlet', serif", q: "Hahmlet:wght@400;600;800", note: "개성 있는 제목" },
  { name: "Black Han Sans", family: "'Black Han Sans', sans-serif", q: "Black+Han+Sans", note: "묵직한 헤드라인" },
  { name: "Do Hyeon", family: "'Do Hyeon', sans-serif", q: "Do+Hyeon", note: "레트로 간판" },
  { name: "Jua", family: "'Jua', sans-serif", q: "Jua", note: "말랑한 제목" },
  { name: "Nanum Pen Script", family: "'Nanum Pen Script', cursive", q: "Nanum+Pen+Script", note: "손글씨" },
];
const FONTS_URL = "https://fonts.googleapis.com/css2?" + FONT_OPTIONS.map((f) => "family=" + f.q).join("&") + "&display=swap";

const TOKEN_META = {
  "--bg": { label: "배경", group: "color" },
  "--surface": { label: "카드 배경", group: "color" },
  "--text": { label: "본문 글자", group: "color" },
  "--muted": { label: "보조 글자", group: "color" },
  "--accent": { label: "강조색", group: "color" },
  "--accent-ink": { label: "강조색 위 글자", group: "color" },
  "--accent-soft": { label: "연한 강조색", group: "color" },
  "--line": { label: "구분선", group: "color" },
  "--font-head": { label: "제목 글꼴", group: "type" },
  "--font-body": { label: "본문 글꼴", group: "type" },
  "--fs-hero": { label: "첫 화면 제목 크기", group: "type", min: 28, max: 120, step: 1 },
  "--radius": { label: "모서리 둥글기", group: "shape", min: 0, max: 40, step: 1 },
  "--space": { label: "섹션 사이 여백", group: "shape", min: 32, max: 200, step: 2 },
  "--maxw": { label: "콘텐츠 폭", group: "shape", min: 720, max: 1440, step: 10 },
  /* 이 프로젝트 템플릿의 나머지 토큰 (주요 토큰은 Pencil.jsx가 위 이름으로 바꿔 넣는다) */
  "--f-mono": { label: "고정폭 글꼴", group: "type" },
  "--radius-sm": { label: "작은 모서리", group: "shape", min: 0, max: 24, step: 1 },
  "--space-unit": { label: "기본 간격", group: "shape" },
  "--tune-hero": { label: "첫 화면 제목 배율", group: "type", min: 0.7, max: 1.4, step: 0.05 },
  "--tune-headline": { label: "한 줄 소개 배율", group: "type", min: 0.8, max: 1.4, step: 0.05 },
  "--tune-gap": { label: "작업 간격 배율", group: "shape", min: 0.5, max: 2, step: 0.05 },
  "--tune-width": { label: "콘텐츠 폭 배율", group: "shape", min: 0.85, max: 1.2, step: 0.05 },
  "--tune-leading": { label: "줄 간격", group: "type", min: 1.4, max: 2, step: 0.05 },
  "--fs-n1": { label: "작은 글자 크기", group: "type" },
  "--fs-0": { label: "본문 글자 크기", group: "type" },
  "--fs-1": { label: "글자 크기 1단계", group: "type" },
  "--fs-2": { label: "글자 크기 2단계", group: "type" },
  "--fs-3": { label: "글자 크기 3단계", group: "type" },
  "--fs-4": { label: "글자 크기 4단계", group: "type" },
  "--fs-5": { label: "글자 크기 5단계", group: "type" },
  "--fs-6": { label: "글자 크기 6단계", group: "type" },
  "--motion-duration": { label: "움직임 시간", group: "other" },
  "--motion-easing": { label: "움직임 방식", group: "other" },
};

const PRESETS = [
  { id: "mono", name: "정돈된 모노", vars: { "--bg": "#F6F6F4", "--surface": "#FFFFFF", "--text": "#17181A", "--muted": "#5E6166", "--accent": "#17181A", "--accent-ink": "#FFFFFF", "--accent-soft": "#E8E8E5", "--line": "#E0E0DC", "--radius": "6px", "--font-head": "'IBM Plex Sans KR', sans-serif", "--font-body": "'IBM Plex Sans KR', sans-serif" } },
  { id: "editorial", name: "따뜻한 에디토리얼", vars: { "--bg": "#F3EEE7", "--surface": "#FBF8F3", "--text": "#2A231E", "--muted": "#6B5E54", "--accent": "#8F3A24", "--accent-ink": "#FFFFFF", "--accent-soft": "#EADBCF", "--line": "#E0D5C8", "--radius": "3px", "--font-head": "'Nanum Myeongjo', serif", "--font-body": "'Gowun Dodum', sans-serif" } },
  { id: "night", name: "고요한 밤", vars: { "--bg": "#10151F", "--surface": "#18202E", "--text": "#E7EBF3", "--muted": "#9AA4B6", "--accent": "#8DBBFF", "--accent-ink": "#0F1522", "--accent-soft": "#223049", "--line": "#27324A", "--radius": "12px", "--font-head": "'Hahmlet', serif", "--font-body": "'Noto Sans KR', sans-serif" } },
  { id: "pop", name: "말랑한 팝", vars: { "--bg": "#FFF5EC", "--surface": "#FFFFFF", "--text": "#2B2233", "--muted": "#6E6277", "--accent": "#C8361A", "--accent-ink": "#FFFFFF", "--accent-soft": "#FFE0D3", "--line": "#F1E1D6", "--radius": "22px", "--font-head": "'Jua', sans-serif", "--font-body": "'Gowun Dodum', sans-serif" } },
];

const GRAIN_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";
const CURSOR_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='7' fill='none' stroke='%23222' stroke-width='2'/><circle cx='12' cy='12' r='2' fill='%23222'/></svg>";
const ADDONS = [
  { id: "grain", name: "필름 그레인", desc: "종이·필름 같은 질감", css: `body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147483000;opacity:.13;mix-blend-mode:multiply;background-image:url("${GRAIN_SVG}")}` },
  { id: "marker", name: "형광펜 강조", desc: "제목 속 강조어에 형광펜", css: `h1 em,h2 em,h3 em,h1 strong,h2 strong,mark{font-style:normal;color:inherit;background:linear-gradient(transparent 56%, color-mix(in srgb, var(--accent, #FFD84D) 30%, transparent) 56%, color-mix(in srgb, var(--accent, #FFD84D) 30%, transparent) 94%, transparent 94%);padding:0 .06em}` },
  { id: "hand", name: "손글씨 포인트", desc: "강조어를 손글씨체로", fonts: ["Nanum Pen Script"], css: `h1 em,h2 em,h3 em{font-family:'Nanum Pen Script',cursive;font-style:normal;font-weight:400;font-size:1.2em;letter-spacing:0}` },
  { id: "tilt", name: "살짝 기우는 카드", desc: "카드에 마우스를 올리면 반응", css: `@media (prefers-reduced-motion: no-preference){[class*="card"]{transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}[class*="card"]:hover{transform:translateY(-4px) rotate(-.8deg);box-shadow:0 18px 40px -18px rgba(0,0,0,.28)}}` },
  { id: "wavy", name: "물결 밑줄 링크", desc: "본문 링크에 물결 밑줄", css: `p a,li a{text-decoration:underline wavy;text-decoration-color:var(--accent, currentColor);text-underline-offset:4px;text-decoration-thickness:1.5px}` },
  { id: "cursor", name: "동그란 커서", desc: "마우스 커서를 작은 원으로", css: `body{cursor:url("${CURSOR_SVG}") 12 12, auto}` },
];

const TAG_KO = {
  h1: "큰 제목", h2: "제목", h3: "소제목", h4: "소제목", h5: "소제목", h6: "소제목", p: "문단", a: "링크",
  button: "버튼", img: "이미지", svg: "그림", section: "섹션", header: "머리글", footer: "바닥글", nav: "메뉴",
  ul: "목록", ol: "목록", li: "목록 항목", article: "카드", span: "글자", div: "상자", em: "강조", strong: "강조",
  i: "장식", main: "본문", form: "입력 폼", input: "입력칸", figure: "그림", blockquote: "인용", small: "작은 글자",
};

const KNOB_PROPS = ["font-size", "font-weight", "line-height", "letter-spacing", "color", "background-color", "padding-top", "padding-left", "margin-top", "margin-bottom", "gap", "border-radius", "opacity", "max-width", "rotate"];

/* ─────────────────────────── Claude 지시문 ─────────────────────────── */

/* 지시문은 engine/pencilPrompts.js (서버와 같은 코드) */

/* ─────────────────────────── 예시 초안 (AI가 만든 첫 버전이라고 가정) ─────────────────────────── */

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>한서진 포트폴리오</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap">
<style>
:root{
  --bg:#F5F7FA;
  --surface:#FFFFFF;
  --text:#15181E;
  --muted:#586071;
  --accent:#2F5BEA;
  --accent-ink:#FFFFFF;
  --accent-soft:#E5ECFD;
  --line:#E1E5EC;
  --radius:14px;
  --space:104px;
  --maxw:1100px;
  --fs-hero:58px;
  --font-head:'Noto Sans KR', sans-serif;
  --font-body:'Noto Sans KR', sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:16px;line-height:1.7;word-break:keep-all;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 32px}
.site-header{border-bottom:1px solid var(--line);background:var(--bg)}
.nav{display:flex;align-items:center;justify-content:space-between;height:68px}
.logo{font-family:var(--font-head);font-weight:900;font-size:19px;letter-spacing:-.02em}
.nav-links{display:flex;gap:28px;font-size:15px;color:var(--muted)}
.nav-links a:hover{color:var(--text)}
.hero{display:grid;grid-template-columns:1.25fr 1fr;gap:64px;align-items:center;padding:88px 32px var(--space)}
.hero-kicker{font-size:15px;font-weight:700;color:var(--accent)}
.hero h1{margin-top:14px;font-family:var(--font-head);font-size:min(var(--fs-hero), 10.5vw);line-height:1.22;letter-spacing:-.035em;font-weight:800}
.hero-lead{margin-top:22px;font-size:18px;color:var(--muted);max-width:32em}
.actions{margin-top:34px;display:flex;flex-wrap:wrap;gap:12px}
.btn{display:inline-flex;align-items:center;height:50px;padding:0 24px;border-radius:999px;font-weight:700;font-size:15px}
.btn-primary{background:var(--accent);color:var(--accent-ink)}
.btn-ghost{background:var(--surface);border:1px solid var(--line)}
.portrait{position:relative;aspect-ratio:4/5;border-radius:calc(var(--radius) * 1.6);overflow:hidden;background:linear-gradient(160deg,var(--accent-soft),var(--surface) 72%);border:1px solid var(--line)}
.portrait .sun{position:absolute;width:44%;aspect-ratio:1;border-radius:50%;background:var(--accent);top:14%;left:20%;opacity:.9}
.portrait .hill{position:absolute;left:-12%;right:-12%;bottom:-24%;height:60%;border-radius:50% 50% 0 0;background:var(--text);opacity:.9}
.portrait .tag{position:absolute;left:18px;bottom:18px;background:var(--surface);color:var(--text);font-size:13px;font-weight:700;padding:8px 14px;border-radius:999px}
section{padding:var(--space) 0;border-top:1px solid var(--line)}
.section-title{font-family:var(--font-head);font-size:34px;letter-spacing:-.03em;line-height:1.3}
.section-lead{margin-top:12px;color:var(--muted);max-width:36em}
.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:56px;margin-top:36px}
.about-grid p+p{margin-top:14px}
.facts{list-style:none;display:grid;gap:14px}
.facts li{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px}
.facts strong{display:block;font-size:17px}
.facts span{color:var(--muted);font-size:14px}
.projects{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:36px}
.project-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.thumb{height:176px;position:relative;overflow:hidden}
.thumb i{position:absolute;display:block}
.thumb-a{background:linear-gradient(135deg,#C7D7FF,#EEF2FF)}
.thumb-a i{border-radius:50%;background:#2F5BEA}
.thumb-a i:nth-child(1){width:90px;height:90px;left:14%;top:22%;opacity:.18}
.thumb-a i:nth-child(2){width:26px;height:26px;left:28%;top:42%;opacity:.85}
.thumb-a i:nth-child(3){width:120px;height:120px;left:50%;top:12%;opacity:.14}
.thumb-a i:nth-child(4){width:16px;height:16px;left:64%;top:40%;opacity:.95}
.thumb-b{background:linear-gradient(135deg,#FFD9C4,#FFF2E9)}
.thumb-b i:nth-child(1){width:88px;height:150px;left:calc(50% - 44px);top:22px;background:#fff;border-radius:16px;box-shadow:0 12px 30px -14px rgba(120,60,20,.55)}
.thumb-b i:nth-child(2){width:50px;height:10px;left:calc(50% - 25px);top:48px;background:#F08A4B;border-radius:5px}
.thumb-b i:nth-child(3){width:64px;height:28px;left:calc(50% - 32px);top:128px;background:#2B2233;border-radius:8px}
.thumb-c{background:linear-gradient(135deg,#CBEFDD,#EFFAF4)}
.thumb-c i{bottom:26px;width:12%;border-radius:8px 8px 3px 3px;background:#1F9A67}
.thumb-c i:nth-child(1){left:16%;height:36%;opacity:.45}
.thumb-c i:nth-child(2){left:33%;height:56%;opacity:.65}
.thumb-c i:nth-child(3){left:50%;height:44%;opacity:.55}
.thumb-c i:nth-child(4){left:67%;height:70%;opacity:.9}
.project-body{padding:20px 22px 24px}
.project-body h3{font-size:19px;letter-spacing:-.02em;line-height:1.4}
.project-body p{margin-top:8px;color:var(--muted);font-size:15px}
.tags{margin-top:14px;display:flex;flex-wrap:wrap;gap:6px}
.tags span{font-size:12.5px;font-weight:600;color:var(--accent);background:var(--accent-soft);padding:4px 10px;border-radius:999px}
.skills{display:flex;flex-wrap:wrap;gap:10px;margin-top:30px;list-style:none}
.skills li{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:9px 16px;font-weight:500;font-size:15px}
.contact{text-align:center}
.contact .section-lead{margin-left:auto;margin-right:auto}
.contact .actions{justify-content:center}
.site-footer{border-top:1px solid var(--line);padding:28px 0;color:var(--muted);font-size:14px}
.site-footer .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
@media (max-width: 900px){
  .hero{grid-template-columns:1fr;gap:44px}
  .portrait{max-width:420px}
  .projects{grid-template-columns:1fr 1fr}
  .about-grid{grid-template-columns:1fr;gap:28px}
}
@media (max-width: 600px){
  .wrap{padding:0 20px}
  .nav-links{display:none}
  .hero{padding:48px 20px calc(var(--space) * .6)}
  .hero-lead{font-size:16px}
  section{padding:calc(var(--space) * .6) 0}
  .section-title{font-size:27px}
  .projects{grid-template-columns:1fr}
}
</style>
</head>
<body>
<header class="site-header">
  <div class="wrap nav">
    <a class="logo" href="#top">한서진</a>
    <nav class="nav-links"><a href="#about">소개</a><a href="#work">프로젝트</a><a href="#skills">기술</a><a href="#contact">연락</a></nav>
  </div>
</header>
<main id="top">
  <div class="wrap hero">
    <div class="hero-text">
      <p class="hero-kicker">프론트엔드 개발자</p>
      <h1>복잡한 데이터를 <em>한눈에 읽히는</em> 화면으로 바꿉니다</h1>
      <p class="hero-lead">공공 데이터와 사용자 조사를 바탕으로 누구나 이해할 수 있는 인터페이스를 설계하고 만듭니다. 요즘은 지도와 차트를 활용한 시각화 프로젝트에 집중하고 있어요.</p>
      <div class="actions"><a class="btn btn-primary" href="#work">프로젝트 보기</a><a class="btn btn-ghost" href="#contact">연락하기</a></div>
    </div>
    <div class="portrait" aria-hidden="true"><span class="sun"></span><span class="hill"></span><span class="tag">서울에서 일해요</span></div>
  </div>
  <section id="about">
    <div class="wrap">
      <h2 class="section-title">소개</h2>
      <div class="about-grid">
        <div>
          <p>대학에서 통계학을 공부하다가, 숫자를 사람에게 설명하는 일이 더 재미있다는 걸 알게 됐습니다. 그 뒤로 데이터를 화면에 옮기는 일을 계속하고 있어요.</p>
          <p>기능이 많은 화면보다 한 가지를 분명하게 전하는 화면을 좋아합니다. 디자이너, 기획자와 같은 언어로 이야기하는 개발자가 되고 싶어요.</p>
        </div>
        <ul class="facts">
          <li><strong>3년 차 프론트엔드 개발자</strong><span>React, TypeScript 중심</span></li>
          <li><strong>공공데이터 공모전 우수상</strong><span>2025 열린데이터 활용 부문</span></li>
          <li><strong>데이터 시각화 스터디 운영</strong><span>매주 한 편씩 차트 리디자인</span></li>
        </ul>
      </div>
    </div>
  </section>
  <section id="work">
    <div class="wrap">
      <h2 class="section-title">프로젝트</h2>
      <p class="section-lead">최근 1년 동안 만든 것 중 가장 애정이 가는 세 가지예요.</p>
      <div class="projects">
        <article class="project-card">
          <div class="thumb thumb-a"><i></i><i></i><i></i><i></i></div>
          <div class="project-body"><h3>서울 대기질 지도</h3><p>구별 미세먼지 데이터를 시간대별로 비교하는 인터랙티브 지도</p><div class="tags"><span>React</span><span>D3</span><span>공공데이터</span></div></div>
        </article>
        <article class="project-card">
          <div class="thumb thumb-b"><i></i><i></i><i></i></div>
          <div class="project-body"><h3>동네 책방 모임 예약</h3><p>예약 단계를 다섯 번에서 두 번으로 줄인 모바일 웹</p><div class="tags"><span>Next.js</span><span>Supabase</span></div></div>
        </article>
        <article class="project-card">
          <div class="thumb thumb-c"><i></i><i></i><i></i><i></i></div>
          <div class="project-body"><h3>수업 피드백 대시보드</h3><p>학생 설문을 모아 선생님이 바로 읽을 수 있게 정리한 요약 화면</p><div class="tags"><span>TypeScript</span><span>Chart.js</span></div></div>
        </article>
      </div>
    </div>
  </section>
  <section id="skills">
    <div class="wrap">
      <h2 class="section-title">주로 쓰는 도구</h2>
      <ul class="skills"><li>React</li><li>TypeScript</li><li>Next.js</li><li>D3.js</li><li>Figma</li><li>Python</li><li>SQL</li></ul>
    </div>
  </section>
  <section id="contact" class="contact">
    <div class="wrap">
      <h2 class="section-title">함께 만들고 싶은 게 있다면</h2>
      <p class="section-lead">새 프로젝트, 스터디, 커피챗 모두 좋아요. 메일로 편하게 연락 주세요.</p>
      <div class="actions"><a class="btn btn-primary" href="mailto:hello@example.com">hello@example.com</a><a class="btn btn-ghost" href="#top">GitHub</a></div>
    </div>
  </section>
</main>
<footer class="site-footer"><div class="wrap"><span>© 2026 한서진</span><span>마지막 업데이트 2026년 9월</span></div></footer>
</body>
</html>`;

/* ─────────────────────────── 작은 도구들 ─────────────────────────── */

const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const cssId = (id) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : String(id).replace(/"/g, '\\"'));
const cut = (s, n) => (s.length > n ? s.slice(0, n) + "…" : s);

function timeAgo(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 10) return "방금";
  if (s < 60) return `${s}초 전`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(t).toLocaleDateString("ko-KR");
}

let colorCtx = null;
function toHex(color) {
  if (!color || typeof document === "undefined") return null;
  const v = String(color).trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return ("#" + v.slice(1).split("").map((c) => c + c).join("")).toLowerCase();
  try {
    if (!colorCtx) colorCtx = document.createElement("canvas").getContext("2d");
    colorCtx.fillStyle = "#010203";
    colorCtx.fillStyle = v;
    const out = colorCtx.fillStyle;
    if (out === "#010203" && v.toLowerCase() !== "#010203") return null;
    if (out.startsWith("#")) return out.toLowerCase();
    const m = out.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a] = m[1].split(",").map((x) => parseFloat(x));
    if (a === 0) return null;
    return "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}
function luminance(hex) {
  const n = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrastRatio(a, b) {
  const A = luminance(a), B = luminance(b);
  return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
}

/* CSS의 :root 최상위 변수만 읽기 (미디어쿼리 안의 :root는 제외) */
function extractRootVars(css) {
  const vars = {};
  const src = String(css || "").replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0, prelude = "", i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "{") {
      if (depth === 0 && /^(:root|html)(\s*,\s*(:root|html))*$/.test(prelude.trim())) {
        const end = src.indexOf("}", i);
        if (end < 0) break;
        src.slice(i + 1, end).split(";").forEach((d) => {
          const k = d.indexOf(":");
          if (k < 0) return;
          const name = d.slice(0, k).trim(), val = d.slice(k + 1).trim();
          if (name.startsWith("--") && val) vars[name] = val;
        });
        i = end + 1; prelude = ""; continue;
      }
      depth++; prelude = ""; i++; continue;
    }
    if (ch === "}") { depth = Math.max(0, depth - 1); prelude = ""; i++; continue; }
    if (ch === ";" && depth === 0) { prelude = ""; i++; continue; }
    prelude += ch; i++;
  }
  return vars;
}

function tokenKind(name, value) {
  const v = String(value || "").trim();
  if (/font/i.test(name) || /['"]/.test(v) || /(sans-serif|serif|monospace|cursive)\s*$/.test(v)) return "font";
  if (/^#([0-9a-f]{3,8})$/i.test(v) || /^(rgb|hsl)a?\(/i.test(v)) return "color";
  if (/^-?\d*\.?\d+(px|rem|em|%|vw|vh|ch)?$/.test(v)) return "number";
  return "text";
}
function parseNum(v) {
  const m = String(v).trim().match(/^(-?\d*\.?\d+)([a-z%]*)$/i);
  return m ? { num: parseFloat(m[1]), unit: m[2] || "" } : { num: 0, unit: "" };
}
function rangeFor(name, num, unit, meta) {
  if (meta && meta.min != null) return { min: meta.min, max: Math.max(meta.max, num), step: meta.step || 1 };
  if (unit === "px") return { min: 0, max: Math.max(48, Math.ceil(num * 3)), step: 1 };
  if (unit === "rem" || unit === "em") return { min: 0, max: Math.max(4, round(num * 3, 1)), step: 0.05 };
  if (unit === "%") return { min: 0, max: 100, step: 1 };
  return { min: 0, max: Math.max(3, round(num * 3, 1)), step: 0.05 };
}
function matchFont(value) {
  const first = String(value || "").split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
  const f = FONT_OPTIONS.find((o) => o.name.toLowerCase() === first);
  return f ? f.family : value;
}

/* ── 초안 CSS를 Shadow DOM에서 그대로 보이도록 바꾸기 ──
   :root/html/body → .pf-html/.pf-body, 너비 미디어쿼리 → 컨테이너 쿼리(기기 폭 미리보기), vw → cqw */
function rewriteSelector(sel) {
  return sel
    .replace(/:root\b/g, ".pf-html")
    .replace(/(^|[\s,>+~(])html(?![\w-])/g, "$1.pf-html")
    .replace(/(^|[\s,>+~(])body(?![\w-])/g, "$1.pf-body");
}
function mediaToContainer(m) {
  const t = String(m || "").trim();
  if (!t || t.includes(",") || !/\bwidth\b/.test(t)) return null;
  if (/(height|orientation|aspect-ratio|resolution|hover|pointer|prefers-|device-|print|\bnot\b|\bcolor\b)/.test(t)) return null;
  const q = t.replace(/\bonly\b/g, "").replace(/\b(screen|all)\b(\s+and\b)?/g, "").trim().replace(/^and\s+/, "");
  return q.startsWith("(") ? q : null;
}
function serializeRules(rules) {
  let out = "";
  for (const r of rules) {
    if (typeof CSSStyleRule !== "undefined" && r instanceof CSSStyleRule) {
      const nested = r.cssRules && r.cssRules.length ? serializeRules(r.cssRules) : "";
      out += `${rewriteSelector(r.selectorText)}{${r.style.cssText}${nested}}\n`;
    } else if (typeof CSSMediaRule !== "undefined" && r instanceof CSSMediaRule) {
      const cq = mediaToContainer(r.media.mediaText);
      out += `${cq ? `@container pf-frame ${cq}` : `@media ${r.media.mediaText}`}{${serializeRules(r.cssRules)}}\n`;
    } else if (typeof CSSSupportsRule !== "undefined" && r instanceof CSSSupportsRule) {
      out += `@supports ${r.conditionText}{${serializeRules(r.cssRules)}}\n`;
    } else if (typeof CSSFontFaceRule !== "undefined" && r instanceof CSSFontFaceRule) {
      /* 글꼴 선언은 문서 head로 올려서 적용 (hoistFonts) */
    } else out += r.cssText + "\n";
  }
  return out;
}
function rewriteCss(css) {
  const src = String(css || "").replace(/@import[^;]*;/g, "");
  if (!src.trim()) return "";
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(src);
    return serializeRules(sheet.cssRules).replace(/(\d)vw\b/g, "$1cqw");
  } catch {
    return src.replace(/:root\b/g, ".pf-html")
      .replace(/(^|[\s,{}>+~(])html(?=[\s,{.:#[>+~)])/g, "$1.pf-html")
      .replace(/(^|[\s,{}>+~(])body(?=[\s,{.:#[>+~)])/g, "$1.pf-body");
  }
}
const varsToCss = (vars) => {
  const e = Object.entries(vars || {});
  return e.length ? `:root{${e.map(([k, v]) => `${k}:${v};`).join("")}}` : "";
};
const addonsToCss = (ids) => (ids || []).map((id) => ADDONS.find((a) => a.id === id)?.css || "").join("\n");
const knobsToCss = (knobs) => (knobs || []).map((k) => `${k.selector}{${k.property}:${k.type === "color" ? k.value : `${k.value}${k.unit || ""}`} !important}`).join("\n");

function ensureHeadLink(href) {
  if (typeof document === "undefined" || !/^https?:\/\//.test(href)) return;
  const exists = [...document.head.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.getAttribute("href") === href);
  if (exists) return;
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = href; l.setAttribute("data-blue-pencil", "");
  document.head.appendChild(l);
}
function hoistFonts(doc) {
  if (typeof document === "undefined") return;
  const hrefs = new Set(doc.links || []);
  String(doc.css || "").replace(/@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)['"]?\s*\)?[^;]*;/g, (_, u) => { hrefs.add(u); return ""; });
  hrefs.forEach(ensureHeadLink);
  const faces = String(doc.css || "").match(/@font-face\s*\{[^}]*\}/g);
  if (faces) {
    let st = document.getElementById("blue-pencil-fonts");
    if (!st) { st = document.createElement("style"); st.id = "blue-pencil-fonts"; document.head.appendChild(st); }
    const t = faces.join("\n");
    if (st.textContent !== t) st.textContent = t;
  }
}

/* ─────────────────────────── 문서 모델 ─────────────────────────── */

function parseHtml(html) {
  const d = new DOMParser().parseFromString(String(html || ""), "text/html");
  let vars = {}, knobs = [], addons = [];
  const cssParts = [];
  for (const s of [...d.querySelectorAll("style")]) {
    const id = s.getAttribute("id") || "";
    if (id === "pf-tweaks") vars = extractRootVars(s.textContent || "");
    else if (id === "pf-knobs") { try { knobs = JSON.parse(s.getAttribute("data-knobs") || "[]"); } catch { knobs = []; } }
    else if (id === "pf-addons") addons = (s.getAttribute("data-addons") || "").split(",").map((x) => x.trim()).filter((x) => ADDONS.some((a) => a.id === x));
    else cssParts.push(s.textContent || "");
    s.remove();
  }
  const links = [...d.querySelectorAll('link[rel~="stylesheet"][href]')].map((l) => { const h = l.getAttribute("href"); l.remove(); return h; });
  const headKeep = [...d.head.children].filter((n) => {
    if (n.tagName === "TITLE") return false;
    if (n.tagName === "META" && (n.hasAttribute("charset") || (n.getAttribute("name") || "").toLowerCase() === "viewport")) return false;
    return true;
  }).map((n) => n.outerHTML).join("\n");
  const body = d.body;
  let max = 0;
  body.querySelectorAll("[data-pf-id]").forEach((el) => {
    const n = parseInt((el.getAttribute("data-pf-id") || "").replace("pf-", ""), 10);
    if (n > max) max = n;
  });
  body.querySelectorAll("*").forEach((el) => { if (!el.hasAttribute("data-pf-id")) el.setAttribute("data-pf-id", "pf-" + ++max); });
  return {
    title: (d.title || "내 포트폴리오").trim(),
    lang: d.documentElement.getAttribute("lang") || "ko",
    css: cssParts.join("\n").trim(),
    links, headKeep,
    bodyAttrs: [...body.attributes].filter((a) => a.name !== "data-pf-id").map((a) => [a.name, a.value]),
    body: body.innerHTML.trim(),
    vars, knobs: Array.isArray(knobs) ? knobs : [], addons,
  };
}

function neededFontLink(doc) {
  const used = new Set();
  const scan = (v) => FONT_OPTIONS.forEach((f) => { if (String(v).includes(f.name)) used.add(f); });
  Object.values(doc.vars || {}).forEach(scan);
  (doc.addons || []).forEach((id) => (ADDONS.find((a) => a.id === id)?.fonts || []).forEach(scan));
  const existing = (doc.links || []).join(" ") + " " + (String(doc.css).match(/@import[^;]+;/g) || []).join(" ");
  const missing = [...used].filter((f) => !existing.includes(f.q.split(":")[0]));
  return missing.length ? `https://fonts.googleapis.com/css2?${missing.map((f) => "family=" + f.q).join("&")}&display=swap` : null;
}

function buildExportHtml(doc, { keepIds = false } = {}) {
  const t = document.createElement("template");
  t.innerHTML = doc.body;
  const addonCss = addonsToCss(doc.addons);
  const knobCss = knobsToCss(doc.knobs);
  if (!keepIds) {
    /* CSS나 노브가 가리키는 요소의 id는 남겨야 내보낸 페이지에서도 그대로 보임 */
    const used = new Set();
    `${doc.css}\n${knobCss}`.replace(/data-pf-id\s*=\s*["']?(pf-\d+)/g, (_, id) => { used.add(id); return ""; });
    t.content.querySelectorAll("[data-pf-id]").forEach((el) => { if (!used.has(el.getAttribute("data-pf-id"))) el.removeAttribute("data-pf-id"); });
  }
  const attrs = (doc.bodyAttrs || []).map(([n, v]) => ` ${n}="${esc(v)}"`).join("");
  const extraFont = neededFontLink(doc);
  const varsCss = Object.entries(doc.vars || {}).map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return [
    "<!DOCTYPE html>",
    `<html lang="${esc(doc.lang || "ko")}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(doc.title)}</title>`,
    ...(doc.links || []).map((h) => `<link rel="stylesheet" href="${esc(h)}">`),
    extraFont ? `<link rel="stylesheet" href="${esc(extraFont)}">` : "",
    doc.headKeep || "",
    `<style>\n${doc.css}\n</style>`,
    varsCss ? `<style id="pf-tweaks">\n:root {\n${varsCss}\n}\n</style>` : "",
    addonCss ? `<style id="pf-addons" data-addons="${esc((doc.addons || []).join(","))}">\n${addonCss}\n</style>` : "",
    knobCss ? `<style id="pf-knobs" data-knobs="${esc(JSON.stringify(doc.knobs))}">\n${knobCss}\n</style>` : "",
    "</head>",
    `<body${attrs}>`,
    t.innerHTML,
    "</body>",
    "</html>",
  ].filter(Boolean).join("\n");
}

function buildHandoff(doc, anns) {
  const change = anns.filter((a) => a.kind !== "keep" && a.status !== "resolved" && a.text.trim());
  const keep = anns.filter((a) => a.kind === "keep");
  const line = (a) => {
    const t = (a.targetsInfo || []).map((x) => `\`[data-pf-id="${x.id}"]\` ${x.label}`).join(", ") || "페이지 전체";
    return [
      `### #${a.n} ${TYPE_LABEL[a.type]}${a.category ? `, ${CAT_LABEL[a.category]}` : ""} (${DEVICES[a.device]?.label || ""} ${DEVICES[a.device]?.w || ""}px에서 표시)`,
      `- 대상: ${t}`,
      a.type === "arrow" ? `- 화살표: \`${a.from.anchorId || "빈 곳"}\` 에서 \`${a.to.anchorId || "빈 곳"}\` 쪽으로` : "",
      `- 요청: ${a.text || "(메모 없음)"}`,
      a.status === "applied" ? `- 상태: 편집기에서 이미 반영함${a.reply ? ` (${a.reply})` : ""}` : "",
    ].filter(Boolean).join("\n");
  };
  const tokens = { ...extractRootVars(doc.css), ...doc.vars };
  return [
    "# 포트폴리오 수정 요청서",
    "",
    `블루펜슬에서 표시한 수정 요청 ${change.length}건입니다. 아래 HTML의 요소에는 \`data-pf-id\`가 붙어 있어요. 요청마다 해당 요소만 고치고, "유지" 항목은 건드리지 말아 주세요. 사실(수상, 경력, 숫자)은 새로 지어내지 마세요.`,
    "",
    "## 수정 요청",
    change.length ? change.map(line).join("\n\n") : "(없음)",
    "",
    "## 유지해 주세요",
    keep.length ? keep.map(line).join("\n\n") : "(없음)",
    "",
    "## 현재 디자인 토큰",
    "```css",
    `:root {\n${Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}`,
    "```",
    "",
    "## 현재 HTML",
    "```html",
    buildExportHtml(doc, { keepIds: true }),
    "```",
  ].join("\n");
}

function outline(bodyEl, maxLines = 220) {
  const lines = [];
  const walk = (el, depth) => {
    for (const c of el.children) {
      if (lines.length >= maxLines) return;
      const tag = c.tagName.toLowerCase();
      if (tag === "script" || tag === "style") continue;
      const id = c.getAttribute("data-pf-id");
      if (!id) { walk(c, depth); continue; }
      const cls = (c.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => "." + x).join("");
      const own = [...c.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim();
      lines.push(`${"  ".repeat(depth)}${id} ${tag}${cls}${own ? ` "${cut(own, 48)}"` : ""}`);
      if (depth < 7 && tag !== "svg") walk(c, depth + 1);
    }
  };
  walk(bodyEl, 0);
  return lines.join("\n");
}

function kindName(el) {
  if (!el) return "";
  const cls = (el.getAttribute("class") || "").toLowerCase();
  if (/\bbtn|button/.test(cls)) return "버튼";
  if (/card/.test(cls)) return "카드";
  if (/\btags?\b|chip|badge/.test(cls)) return "태그";
  if (/thumb|image|img|photo|portrait/.test(cls)) return "이미지";
  if (/logo/.test(cls)) return "로고";
  return TAG_KO[el.tagName.toLowerCase()] || el.tagName.toLowerCase();
}
function visibleText(el) {
  let t = "";
  try { t = el.innerText; } catch { /* 일부 환경 */ }
  return String(t || el.textContent || "").replace(/\s+/g, " ").trim();
}
function labelOf(el) {
  if (!el) return "";
  const text = visibleText(el);
  return `${kindName(el)}${text ? ` "${cut(text, 20)}"` : ""}`;
}
function techLabel(el) {
  const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean)[0];
  const text = visibleText(el);
  return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${text ? ` "${cut(text, 30)}"` : ""}`;
}

function sanitizeHtml(html) {
  const t = document.createElement("template");
  t.innerHTML = String(html ?? "");
  t.content.querySelectorAll("script,iframe,object,embed,link,meta,base").forEach((n) => n.remove());
  t.content.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((a) => {
      if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    });
  });
  return t.innerHTML;
}

const POS = { before: "beforebegin", after: "afterend", prepend: "afterbegin", append: "beforeend" };

/* Claude가 돌려준 수정 명령(ops)을 살아 있는 페이지에 적용 */
function applyOps(ops, ctx) {
  const report = { applied: 0, skipped: [], css: "", vars: {} };
  const isKept = (el) => [...ctx.keep].some((k) => el.closest(`[data-pf-id="${cssId(k)}"]`) || el.querySelector(`[data-pf-id="${cssId(k)}"]`));
  for (const op of Array.isArray(ops) ? ops : []) {
    try {
      if (!op || typeof op !== "object") continue;
      if (op.op === "var") {
        if (/^--[\w-]+$/.test(op.name || "") && typeof op.value === "string" && !/[;{}<]/.test(op.value)) { report.vars[op.name] = op.value.trim(); report.applied++; }
        else report.skipped.push("잘못된 토큰 변경");
        continue;
      }
      if (op.op === "css") {
        if (typeof op.css === "string" && !/<\/?(style|script)|javascript:|@import/i.test(op.css)) { report.css += "\n" + op.css.trim(); report.applied++; }
        else report.skipped.push("허용되지 않는 CSS");
        continue;
      }
      const el = op.id ? ctx.find(op.id) : null;
      if (!el) { report.skipped.push(`${op.id || "?"}를 찾지 못함`); continue; }
      if (isKept(el)) { report.skipped.push(`${op.id}는 유지 요청된 부분`); continue; }
      switch (op.op) {
        case "text": el.textContent = String(op.text ?? ""); break;
        case "html": el.innerHTML = sanitizeHtml(op.html); ctx.assign(); break;
        case "replace": {
          const t = document.createElement("template");
          t.innerHTML = sanitizeHtml(op.html);
          const first = t.content.firstElementChild;
          if (!first) throw new Error("빈 HTML");
          if (!first.hasAttribute("data-pf-id")) first.setAttribute("data-pf-id", op.id);
          el.replaceWith(t.content);
          ctx.assign();
          break;
        }
        case "insert": el.insertAdjacentHTML(POS[op.position] || "afterend", sanitizeHtml(op.html)); ctx.assign(); break;
        case "remove": el.remove(); break;
        case "move": {
          const to = ctx.find(op.to);
          if (!to || to === el || el.contains(to)) throw new Error("이동 위치 없음");
          to.insertAdjacentElement(POS[op.position] || "afterend", el);
          break;
        }
        case "style":
          Object.entries(op.style || {}).forEach(([k, v]) => {
            const prop = k.startsWith("--") || k.includes("-") ? k : k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
            if (v === "" || v == null) el.style.removeProperty(prop); else el.style.setProperty(prop, String(v));
          });
          break;
        case "attr": {
          const n = String(op.name || "").toLowerCase();
          const v = String(op.value ?? "");
          if (!n || n.startsWith("on") || n === "data-pf-id" || /^\s*javascript:/i.test(v)) throw new Error("허용되지 않는 속성");
          el.setAttribute(n, v);
          break;
        }
        default: report.skipped.push(`알 수 없는 명령 ${op.op}`); continue;
      }
      report.applied++;
    } catch (e) {
      report.skipped.push(`${op?.op || "?"} 실패`);
    }
  }
  return report;
}

function parseJsonLoose(text) {
  let t = String(text || "").replace(/```json|```/g, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

function sanitizeKnobs(list, group) {
  const out = [];
  for (const k of Array.isArray(list) ? list : []) {
    if (!k || typeof k !== "object") continue;
    const property = String(k.property || "").trim();
    const selector = String(k.selector || "").trim();
    if (!/^(--[\w-]+|[a-z][a-z-]*)$/.test(property) || !selector || selector.length > 240 || /[{}<]/.test(selector)) continue;
    try { document.createDocumentFragment().querySelector(selector); } catch { continue; }
    const label = cut(String(k.label || property), 20);
    if (k.type === "color") {
      const hex = toHex(String(k.value || ""));
      if (hex) out.push({ id: uid(), group, label, selector, property, type: "color", value: hex });
      continue;
    }
    const min = Number(k.min), max = Number(k.max), value = Number(k.value);
    if (![min, max, value].every(Number.isFinite) || max <= min) continue;
    const unit = ["px", "rem", "em", "%", "deg", ""].includes(k.unit) ? k.unit : "px";
    const step = Number(k.step) > 0 ? Number(k.step) : (max - min) / 100;
    out.push({ id: uid(), group, label, selector, property, type: "range", unit, min, max, step, value: clamp(value, min, max) });
  }
  return out.slice(0, 6);
}

/* 펜 표시 모양을 말로 풀어서 Claude에게 전달 */
function describeStrokes(strokes) {
  return (strokes || []).map((s) => {
    const b = bboxOf(s.pts);
    const f = s.pts[0], l = s.pts[s.pts.length - 1];
    const closed = Math.hypot(f.x - l.x, f.y - l.y) < Math.max(b.w, b.h) * 0.3;
    const kind = closed && b.w > 20 && b.h > 14 ? "동그라미(강조)" : b.h < 22 && b.w > 40 ? "가로선(밑줄 또는 지우기)" : b.w < 22 && b.h > 40 ? "세로선" : "자유 곡선";
    return s.hl ? `형광펜 ${kind}` : kind;
  }).join(", ");
}

/* ─────────────────────────── 좌표 ─────────────────────────── */

function bboxOf(pts, pad = 0) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of pts) { x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y); }
  return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 };
}
const normBox = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
const toRel = (p, A) => ({ fx: A.w ? (p.x - A.x) / A.w : 0, fy: A.h ? (p.y - A.y) / A.h : 0 });
const fromRel = (r, A) => ({ x: A.x + r.fx * A.w, y: A.y + r.fy * A.h });

/* 표시를 요소 기준 상대 좌표로 저장해 두었다가, 화면 폭이 바뀌어도 같은 요소를 따라가게 계산 */
function resolveGeo(a, lookup) {
  if (a.type === "arrow") {
    const F = lookup(a.from.anchorId), T = lookup(a.to.anchorId);
    if (F === HIDDEN || T === HIDDEN) return null;
    const f = F ? fromRel(a.from.rel, F) : a.from.geo, t = T ? fromRel(a.to.rel, T) : a.to.geo;
    return { from: f, to: t, cx: (f.x + t.x) / 2, cy: (f.y + t.y) / 2, bx: f.x, by: f.y, ax: Math.max(f.x, t.x), ay: Math.min(f.y, t.y), lx: Math.min(f.x, t.x) };
  }
  const A = lookup(a.anchorId);
  if (A === HIDDEN) return null;
  if (a.type === "comment") {
    const p = A ? fromRel(a.rel, A) : a.geo;
    return { x: p.x, y: p.y, cx: p.x, cy: p.y, ax: p.x + 30, ay: p.y - 30, lx: p.x - 6 };
  }
  if (a.type === "region") {
    const b = A ? { x: A.x + a.rel.fx * A.w, y: A.y + a.rel.fy * A.h, w: a.rel.fw * A.w, h: a.rel.fh * A.h } : a.geo;
    return { box: b, cx: b.x + b.w / 2, cy: b.y + b.h / 2, bx: b.x, by: b.y, ax: b.x + b.w, ay: b.y, lx: b.x };
  }
  if (a.type === "draw") {
    const strokes = (a.strokes || []).map((s) => ({ ...s, pts: A ? s.rel.map((r) => fromRel(r, A)) : s.pts }));
    if (!strokes.length) return null;
    const b = bboxOf(strokes.flatMap((s) => s.pts));
    return { strokes, box: b, cx: b.x + b.w / 2, cy: b.y + b.h / 2, bx: strokes[0].pts[0].x, by: strokes[0].pts[0].y, ax: b.x + b.w, ay: b.y, lx: b.x };
  }
  return null;
}

function smoothPath(pts) {
  if (!pts || !pts.length) return "";
  const r = (v) => Math.round(v * 10) / 10;
  if (pts.length < 3) return `M${r(pts[0].x)} ${r(pts[0].y)}` + pts.slice(1).map((p) => ` L${r(p.x)} ${r(p.y)}`).join("");
  let d = `M${r(pts[0].x)} ${r(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${r(pts[i].x)} ${r(pts[i].y)} ${r(mx)} ${r(my)}`;
  }
  const l = pts[pts.length - 1];
  return d + ` L${r(l.x)} ${r(l.y)}`;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* 권한이 없으면 아래 방식 */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}
function downloadText(name, text, type) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch { return false; }
}
function insertPlainText(text) {
  try { if (document.execCommand("insertText", false, text)) return; } catch { /* 아래 방식 */ }
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  r.deleteContents(); r.insertNode(document.createTextNode(text)); r.collapse(false);
}
function placeCaretEnd(el) {
  try {
    const r = document.createRange();
    r.selectNodeContents(el); r.collapse(false);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  } catch { /* 선택 API를 못 쓰는 환경 */ }
}

/* ─────────────────────────── 스타일 ─────────────────────────── */

const SHADOW_BASE_CSS = `:host{all:initial;display:block}
.pf-frame{container:pf-frame / inline-size;position:relative;background:#fff;min-height:320px}
:where(.pf-html){display:block;font-size:16px}
:where(.pf-body){display:block;margin:8px}`;
const SHADOW_UI_CSS = `[data-pf-editing]{outline:2px solid #2F4AE0 !important;outline-offset:3px !important;cursor:text !important;caret-color:#2F4AE0;-webkit-user-modify:read-write}`;

const EDITOR_CSS = `
html,body{margin:0}
.bp{--table:#E4E6E0;--dot:#C9CCC3;--paper:#FBFBF9;--paper2:#F2F3EF;--paper3:#E9EAE5;--line:#D5D7D0;--line2:#E4E5E0;--ink:#1C1E21;--ink2:#575B61;--ink3:#878A90;--blue:#2F4AE0;--blue2:#2236B5;--bluesoft:#E8EBFC;--green:#1C8457;--greensoft:#DDF1E6;--red:#C4391F;--redsoft:#FBE4DF;--amber:#9A6400;--ambersoft:#FBF0D6;--shadow:0 1px 1px rgba(28,30,33,.04),0 12px 32px -14px rgba(28,30,33,.32);
position:relative;display:flex;flex-direction:column;height:100vh;height:100dvh;min-height:440px;overflow:hidden;background:var(--table);color:var(--ink);font-family:'IBM Plex Sans KR',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
.bp *,.bp *::before,.bp *::after{box-sizing:border-box}
.bp button{font:inherit;color:inherit;cursor:pointer;background:none;border:0;padding:0}
.bp button:disabled{cursor:default}
.bp input,.bp select,.bp textarea{font:inherit;color:inherit}
.bp :focus-visible{outline:2px solid var(--blue);outline-offset:2px}
.bp p{margin:0}
.bp-spacer{flex:1}

/* 상단 막대 */
.bp-top{height:52px;flex:none;display:flex;align-items:center;gap:6px;padding:0 10px 0 12px;background:var(--paper);border-bottom:1px solid var(--line);position:relative;z-index:25}
.bp-brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;letter-spacing:-.01em;margin-right:4px;white-space:nowrap}
.bp-mark{width:28px;height:28px;border-radius:8px;background:var(--blue);color:#fff;display:grid;place-items:center;flex:none;transform:rotate(-4deg)}
.bp-title{border:0;background:transparent;font-weight:500;color:var(--ink2);padding:6px 8px;border-radius:7px;width:190px;min-width:0}
.bp-title:hover{background:var(--paper2)}
.bp-title:focus{outline:2px solid var(--blue);background:#fff;color:var(--ink)}
.bp-seg{display:inline-flex;background:var(--paper2);border:1px solid var(--line2);border-radius:10px;padding:2px;gap:2px}
.bp .bp-seg button{height:28px;padding:0 10px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;gap:6px;color:var(--ink2);white-space:nowrap}
.bp .bp-seg button:hover{color:var(--ink)}
.bp .bp-seg button[aria-pressed="true"]{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.1)}
.bp-seg.full{display:flex;width:100%}
.bp .bp-seg.full button{flex:1}
.bp-zoom{display:inline-flex;align-items:center;gap:0;margin-left:6px}
.bp .bp-zoomval{min-width:52px;height:30px;border-radius:8px;font-variant-numeric:tabular-nums;color:var(--ink2)}
.bp .bp-zoomval:hover{background:var(--paper2)}
.bp .bp-ib{width:32px;height:32px;border-radius:9px;display:inline-grid;place-items:center;color:var(--ink2);flex:none;position:relative}
.bp .bp-ib:hover:not(:disabled){background:var(--paper2);color:var(--ink)}
.bp .bp-ib[aria-pressed="true"]{background:var(--bluesoft);color:var(--blue)}
.bp .bp-ib:disabled{opacity:.32}
.bp .bp-ib.sm{width:28px;height:28px;border-radius:8px}
.bp .bp-ib.xs{width:22px;height:22px;border-radius:6px}
.bp .bp-btn{height:32px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:#fff;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-weight:500;white-space:nowrap;flex:none}
.bp .bp-btn:hover:not(:disabled){border-color:#B9BCB4}
.bp .bp-btn:disabled{opacity:.45}
.bp .bp-btn.sm{height:28px;padding:0 9px;font-size:12.5px;border-radius:8px}
.bp .bp-btn.full{width:100%}
.bp .bp-btn.danger{color:var(--red)}
.bp .bp-btn.primary{background:var(--blue);border-color:var(--blue);color:#fff;font-weight:600}
.bp .bp-btn.primary:hover:not(:disabled){background:var(--blue2);border-color:var(--blue2)}
.bp-count{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:rgba(255,255,255,.24);font-size:11px;display:inline-grid;place-items:center;font-variant-numeric:tabular-nums}
.bp-busy{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:14px;background:var(--bluesoft);color:var(--blue);font-weight:500;font-size:12px;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}
.bp-spin{animation:bpSpin 1s linear infinite}
@keyframes bpSpin{to{transform:rotate(360deg)}}

/* 캔버스 */
.bp-main{flex:1;min-height:0;display:flex}
.bp-canvas-wrap{position:relative;flex:1;min-width:0;display:flex;flex-direction:column}
.bp-canvas{flex:1;overflow:auto;background-color:var(--table);background-image:radial-gradient(var(--dot) 1px,transparent 1.2px);background-size:22px 22px;overscroll-behavior:contain}
.bp-stage{position:relative;width:max-content;min-width:100%;display:flex;justify-content:center;align-items:flex-start}
.bp-sizer{position:relative;flex:none;background:#fff;box-shadow:0 0 0 1px rgba(28,30,33,.08),0 22px 60px -30px rgba(28,30,33,.45)}
.bp-page{position:absolute;left:0;top:0;transform-origin:0 0}
.bp-host{position:relative;z-index:0;isolation:isolate}
.bp-capture{position:absolute;inset:0;z-index:3;touch-action:none;cursor:crosshair}
.bp-capture.hand{cursor:grab}
.bp-capture.hand:active{cursor:grabbing}
.bp-marks{position:absolute;left:0;top:0;z-index:4;pointer-events:none}
.bp-svg{position:absolute;left:0;top:0;overflow:visible}
.bp-at{position:absolute;width:0;height:0}
.bp .bp-pin{position:absolute;left:0;bottom:0;transform-origin:0 100%;pointer-events:auto;min-width:28px;height:28px;padding:0 8px;border-radius:14px 14px 14px 3px;background:var(--pc);color:#fff;font-weight:700;font-size:13px;display:grid;place-items:center;box-shadow:0 0 0 2px #fff,0 6px 16px -6px rgba(0,0,0,.5);font-variant-numeric:tabular-nums}
.bp .bp-badge{position:absolute;left:0;top:0;pointer-events:auto;width:24px;height:24px;border-radius:50%;background:var(--pc);color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center;box-shadow:0 0 0 2px #fff,0 4px 12px -4px rgba(0,0,0,.45);font-variant-numeric:tabular-nums}
.bp .bp-pin.done,.bp .bp-badge.done{background:#fff;color:var(--pc);box-shadow:0 0 0 2px var(--pc),0 4px 12px -6px rgba(0,0,0,.35)}
.bp .bp-pin.dim,.bp .bp-badge.dim{opacity:.45}
.bp .bp-pin.new,.bp .bp-badge.new{animation:bpPop .25s ease}
.bp .bp-pin.busy,.bp .bp-badge.busy{animation:bpPulse 1s ease-in-out infinite}
.bp .bp-pin.cur,.bp .bp-badge.cur{box-shadow:0 0 0 2px #fff,0 0 0 5px var(--pc)}
@keyframes bpPop{from{opacity:0}to{opacity:1}}
@keyframes bpPulse{50%{opacity:.45}}
.bp-hl{position:absolute;border:1.5px solid var(--blue);border-radius:2px;pointer-events:none;background:rgba(47,74,224,.04)}
.bp-hl-tag{position:absolute;left:-1px;bottom:100%;transform-origin:0 100%;background:var(--blue);color:#fff;font-size:11px;font-weight:600;line-height:1;padding:4px 6px;border-radius:4px 4px 4px 0;white-space:nowrap}
.bp-sel{position:absolute;border:2px solid var(--blue);border-radius:2px;pointer-events:none}
.bp-selbar{position:absolute;left:-2px;display:flex;align-items:center;gap:1px;padding:3px;background:var(--ink);color:#fff;border-radius:9px;pointer-events:auto;white-space:nowrap;box-shadow:0 8px 20px -8px rgba(0,0,0,.5)}
.bp-selbar.up{bottom:100%;transform-origin:0 100%}
.bp-selbar.down{top:100%;transform-origin:0 0}
.bp .bp-selbar button{width:28px;height:26px;border-radius:6px;display:grid;place-items:center;color:#fff}
.bp .bp-selbar button:hover{background:rgba(255,255,255,.16)}
.bp-selbar-name{font-size:11.5px;font-weight:600;padding:0 8px 0 6px;max-width:190px;overflow:hidden;text-overflow:ellipsis}
.bp-selbar-hint{font-size:11.5px;padding:0 8px;display:flex;gap:10px;opacity:.9}
.bp-flash{animation:bpFlash 1.5s ease-out}
@keyframes bpFlash{0%{opacity:0}20%{opacity:1}100%{opacity:0}}

/* 도구 막대 */
.bp-rail{position:absolute;left:14px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px;background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);z-index:15}
.bp-rail-sep{width:24px;height:1px;background:var(--line2);margin:4px 0}
.bp .bp-tool{width:38px;height:38px;border-radius:10px;color:var(--ink2);display:grid;place-items:center;position:relative;flex:none}
.bp .bp-tool:hover:not([aria-pressed="true"]){background:var(--paper2);color:var(--ink)}
.bp .bp-tool[aria-pressed="true"]{background:var(--blue);color:#fff}
.bp-rail .bp-tool[data-tip]:hover::after{content:attr(data-tip);position:absolute;left:calc(100% + 10px);top:50%;transform:translateY(-50%);background:var(--ink);color:#fff;font-size:12px;font-weight:500;padding:5px 9px;border-radius:7px;white-space:nowrap;pointer-events:none}
.bp .bp-swatch{width:22px;height:22px;border-radius:50%;background:var(--sw);box-shadow:inset 0 0 0 2px rgba(255,255,255,.5);margin:3px 0;flex:none}
.bp .bp-swatch[aria-pressed="true"]{box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--sw)}
.bp-dock{position:absolute;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;align-items:center;gap:1px;padding:5px;background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);z-index:30}
.bp-dock .bp-tool{width:40px;height:40px}
.bp-dock-sep{width:1px;height:24px;background:var(--line2);margin:0 4px}
.bp-dotcount{position:absolute;top:3px;right:3px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--red);color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center}
.bp-swatchbar{position:absolute;left:50%;bottom:calc(72px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);z-index:30}
.bp-hint{position:absolute;top:12px;left:50%;transform:translateX(-50%);max-width:calc(100% - 24px);background:var(--ink);color:#fff;padding:7px 13px;border-radius:999px;font-size:12px;z-index:14;pointer-events:none;animation:bpHint 3.8s forwards;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@keyframes bpHint{0%{opacity:0;transform:translate(-50%,-4px)}8%{opacity:1;transform:translate(-50%,0)}82%{opacity:1}100%{opacity:0}}
.bp-previewbar{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:6px 6px 6px 14px;background:var(--ink);color:#fff;border-radius:999px;z-index:30;box-shadow:var(--shadow);white-space:nowrap}
.bp .bp-previewbar button{height:28px;padding:0 12px;border-radius:999px;background:#fff;color:var(--ink);font-weight:600}
.bp-progress{position:absolute;top:0;left:0;right:0;height:2px;z-index:16;background:linear-gradient(90deg,transparent,var(--blue),transparent);background-size:40% 100%;background-repeat:no-repeat;animation:bpSlide 1.1s linear infinite}
@keyframes bpSlide{from{background-position:-40% 0}to{background-position:140% 0}}

/* 메모 작성 카드 */
.bp-composer{position:absolute;z-index:20;width:316px;background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 22px 50px -22px rgba(28,30,33,.5),0 2px 6px rgba(28,30,33,.06);padding:12px;display:flex;flex-direction:column;gap:10px}
.bp-composer.sheet{position:absolute;left:0;right:0;bottom:0;width:auto;border-radius:18px 18px 0 0;border-width:1px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom,0px));z-index:45;animation:bpUp .2s ease}
.bp-comp-head{display:flex;align-items:center;gap:9px}
.bp-comp-n{min-width:26px;height:26px;padding:0 7px;border-radius:13px 13px 13px 3px;background:var(--pc);color:#fff;font-weight:700;font-size:12px;display:grid;place-items:center;flex:none}
.bp-comp-title{flex:1;min-width:0;display:flex;flex-direction:column}
.bp-comp-title b{font-size:13px}
.bp-comp-title span{font-size:12px;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-comp-note{font-size:12px;color:var(--ink2);background:var(--paper2);border-radius:8px;padding:6px 9px}
.bp-chips{display:flex;flex-wrap:wrap;gap:5px}
.bp .bp-chip{height:26px;padding:0 10px;border-radius:13px;border:1px solid var(--line);background:#fff;font-size:12px;color:var(--ink2)}
.bp .bp-chip:hover{color:var(--ink);border-color:#B9BCB4}
.bp .bp-chip[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:#fff}
.bp-textarea{width:100%;resize:vertical;min-height:72px;border:1px solid var(--line);border-radius:10px;padding:9px 10px;background:#fff;line-height:1.5;font-size:13.5px}
.bp-textarea:focus{outline:2px solid var(--blue);outline-offset:-1px;border-color:transparent}
.bp-ideas{display:flex;flex-wrap:wrap;gap:5px}
.bp .bp-idea{font-size:12px;padding:5px 9px;border-radius:8px;background:var(--paper2);color:var(--ink2);text-align:left}
.bp .bp-idea:hover{background:var(--bluesoft);color:var(--blue)}
.bp-comp-reply{display:flex;gap:7px;align-items:flex-start;font-size:12.5px;padding:8px 10px;border-radius:9px;background:var(--bluesoft);color:#1E2F99}
.bp-comp-reply.failed{background:var(--redsoft);color:var(--red)}
.bp-comp-reply svg{flex:none;margin-top:2px}
.bp-comp-foot{display:flex;align-items:center;gap:6px}
.bp-kbd-hint{font-size:11px;color:var(--ink3)}
@keyframes bpUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}

/* 오른쪽 패널 */
.bp-side{width:344px;flex:none;border-left:1px solid var(--line);background:var(--paper);display:flex;flex-direction:column;min-height:0}
.bp-tabs{display:flex;gap:2px;padding:6px 8px 0;border-bottom:1px solid var(--line2);flex:none}
.bp .bp-tab{flex:1;padding:6px 2px 8px;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--ink3);font-size:11.5px;font-weight:500;border-bottom:2px solid transparent;margin-bottom:-1px;position:relative}
.bp .bp-tab:hover{color:var(--ink)}
.bp .bp-tab[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--blue)}
.bp-tab-count{position:absolute;top:2px;left:calc(50% + 6px);min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--blue);color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center}
.bp-panel{flex:1;min-height:0;overflow:auto;padding:14px 14px 20px}
.bp-panel-foot{flex:none;display:flex;gap:8px;padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line2);background:var(--paper)}
.bp-panel-foot .bp-btn.primary{flex:1}
.bp-sec{margin-top:18px}
.bp-sec:first-child{margin-top:0}
.bp-sec-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px}
.bp-h{margin:0;font-size:12px;font-weight:600;color:var(--ink2)}
.bp-sec-aside{font-size:11.5px;color:var(--ink3)}
.bp-muted{color:var(--ink2);font-size:12.5px;line-height:1.55}
.bp-warn{display:flex;gap:6px;align-items:flex-start;margin-top:8px !important;font-size:12px;color:var(--amber);background:var(--ambersoft);padding:7px 9px;border-radius:8px}
.bp-warn svg{flex:none;margin-top:1px}
.bp-row{display:flex;align-items:center;gap:8px;min-height:34px}
.bp-row.col{flex-direction:column;align-items:stretch;gap:2px;min-height:0;padding:4px 0}
.bp-row-top{display:flex;align-items:center;gap:8px}
.bp-row-label{flex:1;min-width:0;color:var(--ink);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-row-val{color:var(--ink2);font-size:12px;font-variant-numeric:tabular-nums}
.bp-range{width:100%;accent-color:var(--blue);margin:2px 0;height:22px}
.bp-color{width:30px;height:26px;border:1px solid var(--line);border-radius:7px;padding:2px;background:#fff;cursor:pointer;flex:none}
.bp-color::-webkit-color-swatch-wrapper{padding:0}
.bp-color::-webkit-color-swatch{border:0;border-radius:4px}
.bp-select{height:30px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:0 8px;max-width:200px}
.bp-input{height:30px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:0 8px;width:150px}
.bp-empty{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:6px 2px;color:var(--ink2);font-size:12.5px;line-height:1.6}
.bp-empty-title{font-size:14px;font-weight:600;color:var(--ink)}
.bp-howto{list-style:none;margin:4px 0;padding:0;display:grid;gap:7px;width:100%}
.bp-howto li{display:flex;align-items:center;gap:9px;color:var(--ink)}
.bp-howto-ic{width:28px;height:28px;border-radius:8px;background:var(--paper2);display:grid;place-items:center;flex:none;color:var(--ink2)}
.bp kbd{font-family:inherit;font-size:10.5px;min-width:18px;height:18px;padding:0 4px;border-radius:4px;border:1px solid var(--line);border-bottom-width:2px;background:#fff;display:inline-grid;place-items:center;color:var(--ink2)}
.bp-filter{margin-bottom:10px}

/* 피드백 목록 */
.bp-annlist{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.bp-ann{display:flex;gap:10px;padding:10px;border-radius:11px;border:1px solid var(--line2);background:#fff;cursor:pointer;align-items:flex-start}
.bp-ann:hover{border-color:var(--line)}
.bp-ann.cur{border-color:var(--blue);box-shadow:0 0 0 1px var(--blue)}
.bp-ann-n{min-width:24px;height:24px;padding:0 6px;border-radius:12px 12px 12px 3px;background:var(--pc);color:#fff;font-size:11.5px;font-weight:700;display:grid;place-items:center;flex:none}
.bp-ann-n.done{background:#fff;color:var(--pc);box-shadow:inset 0 0 0 2px var(--pc)}
.bp-ann-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.bp-ann-meta{display:flex;align-items:center;gap:6px;color:var(--ink2);font-size:11.5px;flex-wrap:wrap}
.bp-tag{font-size:11px;padding:1px 7px;border-radius:6px;background:var(--paper2);color:var(--ink2);font-weight:500}
.bp-status{font-size:11px;font-weight:600;padding:1px 7px;border-radius:6px}
.bp-status.open{background:var(--bluesoft);color:var(--blue)}
.bp-status.applying{background:var(--bluesoft);color:var(--blue)}
.bp-status.applied{background:var(--greensoft);color:var(--green)}
.bp-status.failed{background:var(--redsoft);color:var(--red)}
.bp-status.resolved,.bp-status.reverted{background:var(--paper3);color:var(--ink2)}
.bp-status.keep{background:var(--greensoft);color:var(--green)}
.bp-ann-text{font-size:13px;line-height:1.5;color:var(--ink);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all}
.bp-ann-text.empty{color:var(--ink3)}
.bp-ann-reply{font-size:12px;color:var(--ink2);display:flex;gap:5px;align-items:flex-start}
.bp-ann-reply svg{flex:none;margin-top:2px;color:var(--blue)}
.bp-ann-target{font-size:11.5px;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-ann-actions{display:flex;flex-direction:column;gap:2px;flex:none}

/* 조정 */
.bp-presets{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.bp .bp-preset{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:9px 10px;border-radius:10px;border:1px solid var(--line2);background:#fff;text-align:left}
.bp .bp-preset:hover{border-color:var(--ink3)}
.bp-preset b{font-size:13px;font-weight:600}
.bp-dots{display:flex}
.bp-dots i{width:14px;height:14px;border-radius:50%;box-shadow:0 0 0 1.5px #fff;margin-right:-3px}
.bp-checks{display:grid;gap:4px;margin:6px 0 2px;padding:8px 10px;border-radius:10px;background:var(--paper2)}
.bp-check{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--ink2)}
.bp-check b{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--ink);font-weight:600}
.bp-check em{font-style:normal;font-size:11px;padding:1px 6px;border-radius:5px}
.bp-check.ok em{background:var(--greensoft);color:var(--green)}
.bp-check.bad em{background:var(--redsoft);color:var(--red)}
.bp-addons{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.bp .bp-addon{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:9px 10px;border-radius:10px;border:1px solid var(--line2);background:#fff;text-align:left;position:relative}
.bp .bp-addon b{font-size:12.5px;font-weight:600}
.bp .bp-addon span{font-size:11.5px;color:var(--ink2);line-height:1.4}
.bp .bp-addon[aria-pressed="true"]{border-color:var(--blue);background:var(--bluesoft)}
.bp .bp-addon[aria-pressed="true"]::after{content:"";position:absolute;top:9px;right:9px;width:8px;height:8px;border-radius:50%;background:var(--blue)}
.bp-knobgroup{margin-top:10px;padding:8px 10px 6px;border:1px solid var(--line2);border-radius:10px;background:#fff}
.bp-knobgroup-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}
.bp-knobgroup-head b{font-size:12px}
.bp .bp-link{font-size:12px;color:var(--blue);display:inline-flex;align-items:center;gap:5px;padding:4px 0}

/* 요소 */
.bp-crumbs{display:flex;flex-wrap:wrap;gap:3px;align-items:center;margin-bottom:10px}
.bp .bp-crumbs button{font-size:11.5px;padding:2px 7px;border-radius:6px;color:var(--ink2);background:var(--paper2)}
.bp .bp-crumbs button[aria-current="true"]{background:var(--ink);color:#fff}
.bp-insp-title{display:flex;flex-direction:column;gap:2px;margin-bottom:10px}
.bp-insp-title b{font-size:15px}
.bp-insp-title span{font-size:12px;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-actions{display:flex;flex-wrap:wrap;gap:5px}

/* 대화 */
.bp-chat{flex:1;min-height:0;display:flex;flex-direction:column}
.bp-chat-list{flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px}
.bp-msg{max-width:88%;padding:9px 12px;border-radius:14px;font-size:13px;line-height:1.55;word-break:keep-all;white-space:pre-wrap}
.bp-msg.user{align-self:flex-end;background:var(--ink);color:#fff;border-bottom-right-radius:4px}
.bp-msg.assistant{align-self:flex-start;background:#fff;border:1px solid var(--line2);border-bottom-left-radius:4px}
.bp-msg.err{background:var(--redsoft);border-color:transparent;color:var(--red)}
.bp-msg.pending{display:flex;align-items:center;gap:7px;color:var(--ink2)}
.bp-msg-ctx{display:block;font-size:11px;opacity:.7;margin-bottom:3px}
.bp-msg-meta{display:block;font-size:11px;color:var(--ink3);margin-top:4px}
.bp-chat-input{flex:none;border-top:1px solid var(--line2);padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:7px;background:var(--paper)}
.bp-ctx{display:inline-flex;align-self:flex-start;align-items:center;gap:5px;font-size:11.5px;color:var(--blue);background:var(--bluesoft);padding:3px 4px 3px 8px;border-radius:7px;max-width:100%}
.bp-ctx span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp .bp-ctx button{width:18px;height:18px;border-radius:5px;display:grid;place-items:center;color:var(--blue)}
.bp-chat-row{display:flex;gap:8px;align-items:flex-end}
.bp-chat-row textarea{flex:1;resize:none;border:1px solid var(--line);border-radius:12px;padding:9px 11px;background:#fff;line-height:1.5;max-height:140px;font-size:13.5px}
.bp-chat-row textarea:focus{outline:2px solid var(--blue);outline-offset:-1px;border-color:transparent}
.bp .bp-send{width:38px;height:38px;border-radius:11px;background:var(--blue);color:#fff;display:grid;place-items:center;flex:none}
.bp .bp-send:disabled{background:var(--paper3);color:var(--ink3)}
.bp-chat-empty{display:flex;flex-direction:column;gap:8px;color:var(--ink2);font-size:12.5px;line-height:1.6}
.bp-chat-empty b{color:var(--ink);font-size:14px}

/* 기록 */
.bp-hist{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:2px}
.bp .bp-hist-item{width:100%;display:flex;align-items:center;gap:10px;padding:8px 9px;border-radius:9px;text-align:left}
.bp .bp-hist-item:hover{background:var(--paper2)}
.bp .bp-hist-item.cur{background:var(--bluesoft)}
.bp .bp-hist-item.future{opacity:.5}
.bp-hist-dot{width:8px;height:8px;border-radius:50%;background:var(--ink3);flex:none}
.bp-hist-item.cur .bp-hist-dot{background:var(--blue);box-shadow:0 0 0 3px rgba(47,74,224,.2)}
.bp-hist-main{flex:1;min-width:0;display:flex;flex-direction:column}
.bp-hist-main b{font-weight:500;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-hist-main span{font-size:11px;color:var(--ink3)}

/* 모바일 시트 */
.bp-sheet{position:absolute;left:0;right:0;bottom:0;z-index:40;height:min(74%,640px);background:var(--paper);border-radius:18px 18px 0 0;box-shadow:0 -14px 40px -14px rgba(0,0,0,.35);display:flex;flex-direction:column;animation:bpUp .22s ease}
.bp-sheet-top{display:flex;align-items:center;justify-content:center;padding:6px 8px 0;position:relative;flex:none}
.bp-grab{width:38px;height:4px;border-radius:2px;background:var(--line);margin:4px 0}
.bp-sheet-top .bp-ib{position:absolute;right:8px;top:4px}
.bp-backdrop{position:absolute;inset:0;z-index:39;background:rgba(28,30,33,.18)}

/* 모달·알림 */
.bp-modal-back{position:absolute;inset:0;z-index:60;background:rgba(28,30,33,.4);display:grid;place-items:center;padding:16px}
.bp-modal{width:min(680px,100%);max-height:100%;background:var(--paper);border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px -30px rgba(0,0,0,.55)}
.bp-modal-head{display:flex;align-items:center;gap:10px;padding:14px 14px 10px 18px}
.bp-modal-head h3{margin:0;font-size:15px;font-weight:600;flex:1}
.bp-modal-body{padding:0 18px 12px;display:flex;flex-direction:column;gap:10px;min-height:0;overflow:auto}
.bp-modal-foot{display:flex;flex-wrap:wrap;gap:8px;padding:12px 18px 16px;border-top:1px solid var(--line2);align-items:center}
.bp-code{width:100%;height:min(46vh,380px);resize:vertical;border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.5;white-space:pre}
.bp-check-line{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink2)}
.bp-toasts{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;z-index:70;pointer-events:none;width:max-content;max-width:calc(100% - 24px)}
.bp-narrow .bp-toasts{bottom:calc(80px + env(safe-area-inset-bottom,0px))}
.bp-toast{pointer-events:auto;background:var(--ink);color:#fff;padding:9px 12px 9px 14px;border-radius:11px;font-size:13px;display:flex;gap:12px;align-items:center;box-shadow:var(--shadow);animation:bpUp .2s ease}
.bp .bp-toast button{color:#9FB0FF;font-weight:600}

/* 좁은 화면 */
.bp-narrow .bp-top{gap:2px;padding:0 6px}
.bp-narrow .bp-panel{padding:12px 14px 20px}

@media (prefers-reduced-motion: reduce){.bp *{animation:none !important;transition:none !important}}
`;

/* ─────────────────────────── 작은 컴포넌트 ─────────────────────────── */

function Section({ title, aside, children }) {
  return (
    <section className="bp-sec">
      <div className="bp-sec-head"><h4 className="bp-h">{title}</h4>{aside ? <span className="bp-sec-aside">{aside}</span> : null}</div>
      {children}
    </section>
  );
}

function ResetButton({ label, onClick }) {
  return <button className="bp-ib xs" onClick={onClick} title="원래대로" aria-label={`${label} 원래대로`}><RotateCcw size={12} /></button>;
}

function RangeRow({ label, value, min, max, step = 1, unit = "", onChange, onReset }) {
  const v = Number.isFinite(value) ? value : min;
  return (
    <div className="bp-row col">
      <div className="bp-row-top">
        <span className="bp-row-label">{label}</span>
        <span className="bp-row-val">{round(v, 2)}{unit}</span>
        {onReset ? <ResetButton label={label} onClick={onReset} /> : null}
      </div>
      <input type="range" className="bp-range" min={min} max={max} step={step} value={clamp(v, min, max)} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </div>
  );
}

function ColorRow({ label, value, onChange, allowNone, onReset }) {
  return (
    <div className="bp-row">
      <span className="bp-row-label">{label}</span>
      <span className="bp-row-val">{value || "없음"}</span>
      <input type="color" className="bp-color" value={value || "#ffffff"} onChange={(e) => onChange(e.target.value)} aria-label={`${label} 색`} />
      {allowNone && value ? <button className="bp-ib xs" onClick={() => onChange(null)} title="없애기" aria-label={`${label} 없애기`}><X size={12} /></button> : null}
      {onReset ? <ResetButton label={label} onClick={onReset} /> : null}
    </div>
  );
}

function TokenRow({ name, value, onChange, onReset }) {
  const meta = TOKEN_META[name];
  const label = meta?.label || name;
  const kind = tokenKind(name, value);
  if (kind === "color") {
    return <ColorRow label={label} value={toHex(value) || "#000000"} onChange={(v) => v && onChange(v)} onReset={onReset} />;
  }
  if (kind === "font") {
    const cur = matchFont(value);
    const known = FONT_OPTIONS.some((f) => f.family === cur);
    return (
      <div className="bp-row">
        <span className="bp-row-label">{label}</span>
        <select className="bp-select" value={cur} onChange={(e) => onChange(e.target.value)} aria-label={label}>
          {!known ? <option value={cur}>{String(cur).split(",")[0].replace(/['"]/g, "")}</option> : null}
          {FONT_OPTIONS.map((f) => <option key={f.name} value={f.family}>{f.note} ({f.name})</option>)}
        </select>
        {onReset ? <ResetButton label={label} onClick={onReset} /> : null}
      </div>
    );
  }
  if (kind === "number") {
    const { num, unit } = parseNum(value);
    const r = rangeFor(name, num, unit, meta);
    return <RangeRow label={label} value={num} min={r.min} max={r.max} step={r.step} unit={unit} onChange={(v) => onChange(`${v}${unit}`)} onReset={onReset} />;
  }
  return (
    <div className="bp-row">
      <span className="bp-row-label">{label}</span>
      <input className="bp-input" key={value} defaultValue={value} onBlur={(e) => e.target.value !== value && onChange(e.target.value)} aria-label={label} />
    </div>
  );
}

function KnobRow({ k, onChange, onRemove }) {
  if (k.type === "color") {
    return (
      <div className="bp-row">
        <span className="bp-row-label">{k.label}</span>
        <input type="color" className="bp-color" value={k.value} onChange={(e) => onChange(e.target.value)} aria-label={k.label} />
        <button className="bp-ib xs" onClick={onRemove} aria-label={`${k.label} 노브 지우기`}><X size={12} /></button>
      </div>
    );
  }
  return (
    <div className="bp-row col">
      <div className="bp-row-top">
        <span className="bp-row-label">{k.label}</span>
        <span className="bp-row-val">{round(k.value, 2)}{k.unit}</span>
        <button className="bp-ib xs" onClick={onRemove} aria-label={`${k.label} 노브 지우기`}><X size={12} /></button>
      </div>
      <input type="range" className="bp-range" min={k.min} max={k.max} step={k.step} value={k.value} onChange={(e) => onChange(Number(e.target.value))} aria-label={k.label} />
    </div>
  );
}

function ArrowShape({ from, to, color, k, opacity = 1 }) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const L = 16 * k, W = 0.5;
  const p1 = { x: to.x - L * Math.cos(ang - W), y: to.y - L * Math.sin(ang - W) };
  const p2 = { x: to.x - L * Math.cos(ang + W), y: to.y - L * Math.sin(ang + W) };
  const ex = to.x - L * 0.7 * Math.cos(ang), ey = to.y - L * 0.7 * Math.sin(ang);
  return (
    <g opacity={opacity}>
      <circle cx={from.x} cy={from.y} r={4.5 * k} fill={color} />
      <line x1={from.x} y1={from.y} x2={ex} y2={ey} stroke={color} strokeWidth={3 * k} strokeLinecap="round" />
      <polygon points={`${to.x},${to.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`} fill={color} />
    </g>
  );
}

const colorOf = (a) => (a.kind === "keep" ? KEEP_COLOR : a.color || MARK_COLORS[0].value);

/* 페이지 위에 그려지는 표시들 (페이지 좌표계, 줌과 함께 확대·축소됨) */
function MarkupLayer({ list, geoMap, zoom, w, h, draft, markColor, highlighter, hover, sel, editing, flashId, curId, activeIds, onPin, selActions }) {
  const k = 1 / zoom;
  const dim = (a) => a.status === "resolved" || (a.status === "applied" && activeIds.has(a.appliedEntryId));
  return (
    <div className="bp-marks" style={{ width: w, height: h }}>
      <svg className="bp-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {list.map((a) => {
          const g = geoMap[a.id];
          if (!g) return null;
          const col = colorOf(a);
          const op = dim(a) ? 0.35 : 1;
          if (a.type === "region") {
            return <rect key={a.id} x={g.box.x} y={g.box.y} width={g.box.w} height={g.box.h} rx={6 * k} fill={col} fillOpacity={0.07} stroke={col} strokeWidth={2 * k} strokeDasharray={`${7 * k} ${5 * k}`} opacity={op} />;
          }
          if (a.type === "draw") {
            return (
              <g key={a.id} opacity={op}>
                {g.strokes.map((s, i) => <path key={i} d={smoothPath(s.pts)} fill="none" stroke={s.color || col} strokeWidth={s.hl ? 16 : 3 * k} strokeOpacity={s.hl ? 0.38 : 1} strokeLinecap="round" strokeLinejoin="round" />)}
              </g>
            );
          }
          if (a.type === "arrow") return <ArrowShape key={a.id} from={g.from} to={g.to} color={col} k={k} opacity={op} />;
          return null;
        })}
        {draft && draft.t === "region" ? (() => { const b = normBox(draft.start, draft.end); return <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6 * k} fill={markColor} fillOpacity={0.08} stroke={markColor} strokeWidth={2 * k} strokeDasharray={`${7 * k} ${5 * k}`} />; })() : null}
        {draft && draft.t === "draw" ? <path d={smoothPath(draft.pts)} fill="none" stroke={markColor} strokeWidth={highlighter ? 16 : 3 * k} strokeOpacity={highlighter ? 0.38 : 1} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {draft && draft.t === "arrow" ? <ArrowShape from={draft.start} to={draft.end} color={markColor} k={k} /> : null}
        {flashId && geoMap[flashId] ? (() => {
          const g = geoMap[flashId];
          const b = g.box || (g.from ? normBox(g.from, g.to) : { x: g.x - 14, y: g.y - 14, w: 28, h: 28 });
          return <rect key={flashId + "f"} className="bp-flash" x={b.x - 8 * k} y={b.y - 8 * k} width={b.w + 16 * k} height={b.h + 16 * k} rx={10 * k} fill="none" stroke="#2F4AE0" strokeWidth={4 * k} />;
        })() : null}
      </svg>

      {hover ? (
        <div className="bp-hl" style={{ left: hover.rect.x, top: hover.rect.y, width: hover.rect.w, height: hover.rect.h, borderWidth: 1.5 * k }}>
          <span className="bp-hl-tag" style={{ transform: `scale(${k})` }}>{hover.label}</span>
        </div>
      ) : null}

      {sel ? (
        <div className="bp-sel" style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h, borderWidth: 2 * k }}>
          <div className={`bp-selbar ${sel.y * zoom > 44 ? "up" : "down"}`} style={{ transform: `scale(${k})`, [sel.y * zoom > 44 ? "marginBottom" : "marginTop"]: 6 * k }} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            {editing ? (
              <span className="bp-selbar-hint"><span>Enter 완료</span><span>Shift+Enter 줄바꿈</span><span>Esc 취소</span></span>
            ) : (
              <>
                <span className="bp-selbar-name">{sel.label}</span>
                <button title="글자 고치기" aria-label="글자 고치기" onClick={selActions.edit}><Type size={14} /></button>
                <button title="주석 달기" aria-label="주석 달기" onClick={selActions.comment}><MessageSquarePlus size={14} /></button>
                <button title="Claude에게 부탁" aria-label="Claude에게 부탁" onClick={selActions.ask}><Sparkles size={14} /></button>
                <button title="복제" aria-label="복제" onClick={selActions.duplicate}><CopyPlus size={14} /></button>
                <button title="상위 요소 선택" aria-label="상위 요소 선택" onClick={selActions.parent}><CornerLeftUp size={14} /></button>
                <button title="삭제" aria-label="삭제" onClick={selActions.remove}><Trash2 size={14} /></button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {list.map((a) => {
        const g = geoMap[a.id];
        if (!g) return null;
        const cls = [a._pending ? "new" : "", a.status === "applying" ? "busy" : "", dim(a) ? "dim" : "", a.status === "applied" && activeIds.has(a.appliedEntryId) ? "done" : "", curId === a.id ? "cur" : ""].join(" ");
        const label = a._pending ? "+" : a.status === "applied" && activeIds.has(a.appliedEntryId) ? <Check size={13} strokeWidth={3} /> : a.n;
        const title = `#${a.n ?? "새"} ${a.text || TYPE_LABEL[a.type]}`;
        if (a.type === "comment") {
          return (
            <div key={a.id} className="bp-at" style={{ left: g.x, top: g.y }}>
              <button className={`bp-pin ${cls}`} style={{ "--pc": colorOf(a), transform: `scale(${k})` }} title={title} aria-label={title} onClick={(e) => { e.stopPropagation(); onPin(a); }}>{label}</button>
            </div>
          );
        }
        return (
          <div key={a.id} className="bp-at" style={{ left: g.bx, top: g.by }}>
            <button className={`bp-badge ${cls}`} style={{ "--pc": colorOf(a), transform: `translate(-50%,-50%) scale(${k})` }} title={title} aria-label={title} onClick={(e) => { e.stopPropagation(); onPin(a); }}>{label}</button>
          </div>
        );
      })}
    </div>
  );
}

const PLACEHOLDERS = {
  comment: "이 부분을 어떻게 바꾸고 싶나요?\n예) 제목을 한 줄로 줄이고 더 크게",
  region: "이 영역에서 바꾸고 싶은 점을 적어 주세요.\n예) 카드 간격을 넓히고 그림을 더 크게",
  draw: "표시한 곳을 어떻게 바꿀까요?\n예) 동그라미 친 문장을 더 눈에 띄게",
  arrow: "예) 이 버튼을 화살표 끝 위치로 옮겨 줘",
  keep: "무엇이 마음에 드나요? (적지 않아도 돼요)\n예) 이 색 조합은 그대로 두고 싶어요",
};

/* 표시를 만든 뒤 수정 메모를 적는 카드 */
function Composer({ pending, sheet, style, busy, onDraft, onSave, onSaveApply, onCancel, onDelete, onResolve }) {
  const a = pending.ann;
  const isNew = pending.isNew;
  const [kind, setKind] = useState(a.kind || "change");
  const [cat, setCat] = useState(a.category || null);
  const [text, setText] = useState(a.text || "");
  const ta = useRef(null);
  useEffect(() => {
    if (!isNew) return undefined;
    const t = setTimeout(() => ta.current && ta.current.focus({ preventScroll: true }), 40);
    return () => clearTimeout(t);
  }, [isNew]);
  useEffect(() => { onDraft({ kind, category: cat, text }); }, [kind, cat, text]); // eslint-disable-line react-hooks/exhaustive-deps
  const canSave = kind === "keep" || text.trim().length > 0;
  const submit = (apply) => { if (canSave) (apply ? onSaveApply : onSave)({ kind, category: kind === "keep" ? null : cat, text: text.trim() }); };
  const strokes = a.type === "draw" ? (a.strokes || []).length : 0;
  const targets = a.targetsInfo || [];
  return (
    <div className={`bp-composer ${sheet ? "sheet" : ""}`} style={sheet ? undefined : style} role="dialog" aria-label="수정 메모"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onCancel(); } }}>
      <div className="bp-comp-head">
        <span className="bp-comp-n" style={{ "--pc": kind === "keep" ? KEEP_COLOR : a.color }}>{a.n ?? "새"}</span>
        <div className="bp-comp-title">
          <b>{TYPE_LABEL[a.type]}</b>
          <span>{targets[0]?.label || "페이지"}{targets.length > 1 ? ` 외 ${targets.length - 1}개` : ""}</span>
        </div>
        <button className="bp-ib sm" onClick={onCancel} aria-label="닫기"><X size={16} /></button>
      </div>
      {strokes > 0 && isNew ? <p className="bp-comp-note">선 {strokes}개를 그렸어요. 더 그으면 이 메모에 함께 묶여요.</p> : null}
      <div className="bp-seg full" role="group" aria-label="메모 종류">
        <button aria-pressed={kind === "change"} onClick={() => setKind("change")}><PenLine size={14} />고쳐 주세요</button>
        <button aria-pressed={kind === "keep"} onClick={() => setKind("keep")}><ThumbsUp size={14} />이건 좋아요</button>
      </div>
      {kind === "change" ? (
        <div className="bp-chips" role="group" aria-label="분류">
          {CATEGORIES.map((c) => <button key={c.id} className="bp-chip" aria-pressed={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.label}</button>)}
        </div>
      ) : null}
      <textarea ref={ta} className="bp-textarea" rows={sheet ? 3 : 4} value={text} placeholder={kind === "keep" ? PLACEHOLDERS.keep : PLACEHOLDERS[a.type]}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) { e.preventDefault(); submit(false); } }} />
      {kind === "change" && cat === "signature" ? (
        <div className="bp-ideas">
          {SIGNATURE_IDEAS.map((s) => <button key={s} className="bp-idea" onClick={() => setText((t) => (t.trim() ? t.trimEnd() + ", " : "") + s)}>+ {s}</button>)}
        </div>
      ) : null}
      {a.reply ? <div className={`bp-comp-reply ${a.status === "failed" ? "failed" : ""}`}><Sparkles size={13} /><span>{a.reply}</span></div> : null}
      <div className="bp-comp-foot">
        {!isNew ? <button className="bp-ib sm" title="삭제" aria-label="표시 삭제" onClick={onDelete}><Trash2 size={15} /></button> : null}
        {!isNew && a.kind !== "keep" ? <button className="bp-ib sm" title={a.status === "resolved" ? "다시 열기" : "해결로 표시"} aria-label={a.status === "resolved" ? "다시 열기" : "해결로 표시"} onClick={onResolve}><CircleCheck size={15} /></button> : null}
        <span className="bp-spacer" />
        {!sheet && isNew ? <span className="bp-kbd-hint">⌘/Ctrl+Enter</span> : null}
        <button className="bp-btn" disabled={!canSave} onClick={() => submit(false)}>{isNew ? "저장" : "수정 저장"}</button>
        {kind === "change" ? <button className="bp-btn primary" disabled={!canSave || busy} onClick={() => submit(true)}><Sparkles size={14} />바로 반영</button> : null}
      </div>
    </div>
  );
}

function ChatPanel({ chat, busy, ctxLabel, onClearCtx, onSend }) {
  const [text, setText] = useState("");
  const listRef = useRef(null);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [chat.length, busy]);
  const send = (t) => {
    const v = String(t ?? text).trim();
    if (!v || busy) return;
    onSend(v);
    setText("");
  };
  return (
    <div className="bp-chat">
      <div className="bp-chat-list" ref={listRef}>
        {chat.length === 0 ? (
          <div className="bp-chat-empty">
            <b>대화로 크게 바꾸기</b>
            <p>“전체적으로 더 차분하게”처럼 페이지 전체에 대한 요청은 여기서 해요. 요소를 선택한 채로 보내면 그 요소를 중심으로 고쳐요.</p>
            <div className="bp-ideas">{CHAT_SUGGESTIONS.map((s) => <button key={s} className="bp-idea" disabled={!!busy} onClick={() => send(s)}>{s}</button>)}</div>
          </div>
        ) : null}
        {chat.map((m) => (
          <div key={m.id} className={`bp-msg ${m.role} ${m.error ? "err" : ""}`}>
            {m.ctx ? <span className="bp-msg-ctx">{m.ctx}</span> : null}
            {m.text}
            {m.changes > 0 ? <span className="bp-msg-meta">변경 {m.changes}건 반영됨. 기록에서 되돌릴 수 있어요.</span> : null}
          </div>
        ))}
        {busy ? <div className="bp-msg assistant pending"><Loader2 size={14} className="bp-spin" />{busy.label || "고치는 중"}</div> : null}
      </div>
      <div className="bp-chat-input">
        {ctxLabel ? <div className="bp-ctx"><Layers size={12} /><span>선택: {ctxLabel}</span><button onClick={onClearCtx} aria-label="선택 요소 빼기"><X size={12} /></button></div> : null}
        <div className="bp-chat-row">
          <textarea rows={2} value={text} placeholder="Claude에게 바꿀 점을 말해 주세요" aria-label="Claude에게 보낼 메시지"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
          <button className="bp-send" disabled={!text.trim() || !!busy} onClick={() => send()} aria-label="보내기"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function ExportModal({ initialTab, getHtml, getHandoff, getJson, onClose, notify }) {
  const [tab, setTab] = useState(initialTab || "html");
  const [keepIds, setKeepIds] = useState(false);
  const content = useMemo(() => (tab === "html" ? getHtml(keepIds) : tab === "handoff" ? getHandoff() : getJson()), [tab, keepIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const file = tab === "html" ? ["portfolio.html", "text/html"] : tab === "handoff" ? ["수정-요청서.md", "text/markdown"] : ["blue-pencil-data.json", "application/json"];
  return (
    <div className="bp-modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bp-modal" role="dialog" aria-label="내보내기">
        <div className="bp-modal-head"><h3>내보내기</h3><button className="bp-ib" onClick={onClose} aria-label="닫기"><X size={18} /></button></div>
        <div className="bp-modal-body">
          <div className="bp-seg full" role="tablist">
            <button aria-pressed={tab === "html"} onClick={() => setTab("html")}>HTML</button>
            <button aria-pressed={tab === "handoff"} onClick={() => setTab("handoff")}>Claude 요청서</button>
            <button aria-pressed={tab === "json"} onClick={() => setTab("json")}>수정 기록</button>
          </div>
          <p className="bp-muted">
            {tab === "html" ? "지금 보이는 페이지를 그대로 배포할 수 있는 HTML 한 파일이에요." : tab === "handoff" ? "아직 반영하지 않은 수정 요청과 현재 HTML을 묶었어요. Claude Code나 Claude 대화에 그대로 붙여 넣으면 이어서 고칠 수 있어요." : "표시, 직접 고친 내역, Claude에게 맡긴 내역을 담은 데이터예요. 서비스가 사용자 취향을 다시 학습할 때 쓸 수 있어요."}
          </p>
          {tab === "html" ? <label className="bp-check-line"><input type="checkbox" checked={keepIds} onChange={(e) => setKeepIds(e.target.checked)} />편집용 data-pf-id 남기기 (나중에 다시 불러와 이어서 고칠 때)</label> : null}
          <textarea className="bp-code" readOnly value={content} onFocus={(e) => e.target.select()} aria-label="내보낼 내용" />
        </div>
        <div className="bp-modal-foot">
          <span className="bp-muted">{content.length.toLocaleString("ko-KR")}자</span>
          <span className="bp-spacer" />
          <button className="bp-btn" onClick={() => { const ok = downloadText(file[0], content, file[1]); notify(ok ? "파일을 내려받았어요" : "이 환경에서는 내려받기가 막혀 있어요. 복사해서 쓰세요"); }}><Download size={15} />내려받기</button>
          <button className="bp-btn primary" onClick={async () => notify((await copyText(content)) ? "복사했어요" : "복사가 막혀 있어요. 위 내용을 길게 눌러 복사하세요")}><Copy size={15} />복사</button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ hasWork, onImport, onSample, onClose }) {
  const [text, setText] = useState("");
  const readFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setText(String(r.result || ""));
    r.readAsText(f);
  };
  return (
    <div className="bp-modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bp-modal" role="dialog" aria-label="초안 불러오기">
        <div className="bp-modal-head"><h3>초안 불러오기</h3><button className="bp-ib" onClick={onClose} aria-label="닫기"><X size={18} /></button></div>
        <div className="bp-modal-body">
          <p className="bp-muted">AI가 만든 포트폴리오 HTML을 붙여 넣거나 파일을 고르세요. 스타일은 &lt;style&gt;에, 글꼴은 &lt;link&gt;로 들어 있으면 그대로 보여요.</p>
          <textarea className="bp-code" value={text} onChange={(e) => setText(e.target.value)} placeholder="<!DOCTYPE html> 부터 붙여 넣으세요" aria-label="HTML 붙여넣기" />
          {hasWork ? <p className="bp-warn"><TriangleAlert size={13} />불러오면 지금의 표시, 대화, 기록이 새로 시작돼요. 필요하면 먼저 내보내기로 저장하세요.</p> : null}
        </div>
        <div className="bp-modal-foot">
          <label className="bp-btn"><Upload size={15} />파일 고르기<input type="file" accept=".html,.htm,text/html" onChange={readFile} style={{ display: "none" }} /></label>
          <button className="bp-btn" onClick={onSample}>예시 초안으로 새로 시작</button>
          <span className="bp-spacer" />
          <button className="bp-btn primary" disabled={!text.trim()} onClick={() => onImport(text)}>불러오기</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── 편집기 ─────────────────────────── */

export default function BluePencilEditor({ initialHtml, onChange, aiCall }) {
  /* 문서와 버전 기록 */
  const [hist, setHist] = useState(() => ({ entries: [{ id: uid(), doc: parseHtml(initialHtml || SAMPLE_HTML), label: "AI 초안", time: Date.now() }], index: 0 }));
  const doc = hist.entries[hist.index].doc;
  const canUndo = hist.index > 0;
  const canRedo = hist.index < hist.entries.length - 1;
  const activeIds = useMemo(() => new Set(hist.entries.slice(0, hist.index + 1).map((e) => e.id)), [hist]);

  /* 화면 상태 */
  const [tool, setToolState] = useState("select");
  const [device, setDevice] = useState(() => (typeof window !== "undefined" && window.innerWidth < 760 ? "mobile" : "desktop"));
  const [zoomMode, setZoomMode] = useState("fit");
  const [manualZoom, setManualZoom] = useState(1);
  const [preview, setPreview] = useState(false);
  const [showMarks, setShowMarks] = useState(true);
  const [markColor, setMarkColor] = useState(MARK_COLORS[0].value);
  const [highlighter, setHighlighter] = useState(false);
  const [anns, setAnns] = useState([]);
  const [pending, setPending] = useState(null);
  const [draft, setDraft] = useState(null);
  const [hover, setHover] = useState(null);
  const [selId, setSelId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [panel, setPanel] = useState("feedback");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatCtxOff, setChatCtxOff] = useState(false);
  const [editLog, setEditLog] = useState([]);
  const [liveVars, setLiveVars] = useState({});
  const [liveKnobs, setLiveKnobs] = useState({});
  const [toasts, setToasts] = useState([]);
  const [pageH, setPageH] = useState(1200);
  const [layoutTick, setLayoutTick] = useState(0);
  const [geo, setGeo] = useState({ map: {}, sel: null, comp: null });
  const [flashId, setFlashId] = useState(null);
  const [hintTool, setHintTool] = useState(null);
  const [filter, setFilter] = useState("all");
  const [rootW, setRootW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  const [canvasW, setCanvasW] = useState(900);

  /* refs */
  const rootRef = useRef(null), canvasRef = useRef(null), stageRef = useRef(null), pageRef = useRef(null), hostRef = useRef(null);
  const shadowRef = useRef(null), liveBodyRef = useRef(null), idSeqRef = useRef(0), editingRef = useRef(null), dragRef = useRef(null);
  const pendingCommitRef = useRef(null), hoverIdRef = useRef(null), spaceToolRef = useRef(null), composerDraftRef = useRef(null);
  const liveVarsRef = useRef({}), liveKnobsRef = useRef({}), flashTimer = useRef(null), storageReadyRef = useRef(false);
  const S = useRef({});

  const narrow = rootW < 760;
  const compact = rootW < 1180;
  const devW = DEVICES[device].w;
  const padX = narrow ? 12 : 84;
  const fitZoom = clamp((canvasW - padX * 2) / devW, 0.15, 1);
  const zoom = Math.round((zoomMode === "fit" ? fitZoom : manualZoom) * 1000) / 1000;

  const effVars = useMemo(() => ({ ...doc.vars, ...liveVars }), [doc.vars, liveVars]);
  const effKnobs = useMemo(() => (doc.knobs || []).map((k) => (k.id in liveKnobs ? { ...k, value: liveKnobs[k.id] } : k)), [doc.knobs, liveKnobs]);
  const srcCss = useMemo(() => rewriteCss(doc.css), [doc.css]);
  const varsCss = useMemo(() => rewriteCss(varsToCss(effVars)), [effVars]);
  const addonsCss = useMemo(() => rewriteCss(addonsToCss(doc.addons)), [doc.addons]);
  const knobsCss = useMemo(() => rewriteCss(knobsToCss(effKnobs)), [effKnobs]);
  const annStatus = (a) => (a.status === "applied" && !activeIds.has(a.appliedEntryId) ? "reverted" : a.status);
  const openAnns = anns.filter((a) => a.kind !== "keep" && a.text.trim() && ["open", "failed", "reverted"].includes(annStatus(a)));
  const markList = useMemo(() => {
    if (!pending) return anns;
    if (pending.isNew) return [...anns, { ...pending.ann, _pending: true }];
    return anns.map((a) => (a.id === pending.ann.id ? { ...a, ...pending.ann } : a));
  }, [anns, pending]);

  const bump = useCallback(() => setLayoutTick((t) => t + 1), []);
  const toast = useCallback((msg, opts = {}) => {
    const id = uid();
    setToasts((t) => [...t.slice(-2), { id, msg, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.ms || 3400);
  }, []);
  const addLog = (entry) => setEditLog((l) => [...l.slice(-499), { time: Date.now(), device: S.current.device, ...entry }]);

  const commitDoc = useCallback((mutate, label, entryId) => {
    setHist((h) => {
      const cur = h.entries[h.index].doc;
      const next = mutate(cur);
      if (!next || next === cur) return h;
      let entries = h.entries.slice(0, h.index + 1).concat({ id: entryId || uid(), doc: next, label, time: Date.now() });
      if (entries.length > MAX_HISTORY) entries = [entries[0], ...entries.slice(entries.length - MAX_HISTORY + 1)];
      return { entries, index: entries.length - 1 };
    });
  }, []);

  /* 페이지(Shadow DOM) 접근 */
  const getEl = (id) => (id && shadowRef.current ? shadowRef.current.querySelector(`[data-pf-id="${cssId(id)}"]`) : null);
  const bodyEl = () => (shadowRef.current ? shadowRef.current.querySelector(".pf-body") : null);
  const pageBox = () => ({ x: 0, y: 0, w: S.current.devW, h: S.current.pageH });
  const rectOf = (el) => {
    const r = el.getBoundingClientRect(), p = pageRef.current.getBoundingClientRect(), z = S.current.zoom;
    return { x: (r.left - p.left) / z, y: (r.top - p.top) / z, w: r.width / z, h: r.height / z };
  };
  const toPage = (cx, cy) => {
    const p = pageRef.current.getBoundingClientRect(), z = S.current.zoom;
    return { x: (cx - p.left) / z, y: (cy - p.top) / z };
  };
  const elementAtPage = (x, y) => {
    const root = shadowRef.current;
    if (!root) return null;
    const p = pageRef.current.getBoundingClientRect(), z = S.current.zoom;
    try {
      if (root.elementsFromPoint) {
        for (const n of root.elementsFromPoint(p.left + x * z, p.top + y * z)) {
          if (n.getRootNode && n.getRootNode() === root && n.closest) {
            const el = n.closest("[data-pf-id]");
            if (el) return el;
          }
        }
      }
    } catch { /* 아래의 기하 계산으로 대신 */ }
    let best = null, area = Infinity;
    root.querySelectorAll("[data-pf-id]").forEach((el) => {
      const r = rectOf(el);
      if (r.w > 0 && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h && r.w * r.h < area) { best = el; area = r.w * r.h; }
    });
    return best;
  };
  const anchorFor = (box) => {
    let el = elementAtPage(box.x + box.w / 2, box.y + box.h / 2);
    while (el) {
      const r = rectOf(el);
      if (r.x <= box.x + 2 && r.y <= box.y + 2 && r.x + r.w >= box.x + box.w - 2 && r.y + r.h >= box.y + box.h - 2) return { id: el.getAttribute("data-pf-id"), rect: r };
      el = el.parentElement ? el.parentElement.closest("[data-pf-id]") : null;
    }
    return { id: null, rect: pageBox() };
  };
  /* 영역 안의 대상 요소 고르기: 대부분 영역 안에 들어오고, 그린 영역보다 지나치게 크지 않은 요소 */
  const elementsInBox = (box, fallbackId) => {
    const root = shadowRef.current;
    const area = Math.max(1, box.w * box.h);
    const hits = [];
    let cover = null, coverArea = Infinity;
    root.querySelectorAll("[data-pf-id]").forEach((el) => {
      const r = rectOf(el);
      if (r.w < 2 || r.h < 2) return;
      const ix = Math.max(0, Math.min(r.x + r.w, box.x + box.w) - Math.max(r.x, box.x));
      const iy = Math.max(0, Math.min(r.y + r.h, box.y + box.h) - Math.max(r.y, box.y));
      const inter = ix * iy, elArea = r.w * r.h;
      if (inter / elArea >= 0.6 && elArea <= area * 1.3) hits.push(el);
      if (inter >= area * 0.5 && elArea < coverArea) { cover = el; coverArea = elArea; }
    });
    let top = hits.filter((el) => !hits.some((o) => o !== el && o.contains(el))).slice(0, 6);
    if (!top.length && cover) top = [cover];
    if (!top.length && fallbackId) { const f = getEl(fallbackId); if (f) top = [f]; }
    return { ids: top.map((el) => el.getAttribute("data-pf-id")), info: top.map((el) => ({ id: el.getAttribute("data-pf-id"), label: labelOf(el) })) };
  };
  /* 밑줄·세로줄처럼 얇은 펜 표시는 표시한 글자 쪽으로 범위를 넓혀서 대상 찾기 */
  const markBox = (b) => ({
    x: b.w < 30 ? b.x - 20 : b.x,
    y: b.h < 30 ? b.y - 26 : b.y,
    w: b.w < 30 ? b.w + 40 : b.w,
    h: b.h < 30 ? b.h + 32 : b.h,
  });

  const assignIds = () => {
    const b = bodyEl();
    if (b) b.querySelectorAll("*").forEach((el) => { if (!el.hasAttribute("data-pf-id")) el.setAttribute("data-pf-id", "pf-" + ++idSeqRef.current); });
  };
  const syncIdSeq = () => {
    const b = bodyEl();
    if (!b) return;
    b.querySelectorAll("[data-pf-id]").forEach((el) => {
      const n = parseInt((el.getAttribute("data-pf-id") || "").replace("pf-", ""), 10);
      if (n > idSeqRef.current) idSeqRef.current = n;
    });
  };
  const serializeLive = () => {
    const b = bodyEl();
    if (!b) return S.current.doc.body;
    const c = b.cloneNode(true);
    c.querySelectorAll("[data-pf-editing]").forEach((el) => { el.removeAttribute("contenteditable"); el.removeAttribute("data-pf-editing"); el.removeAttribute("spellcheck"); });
    return c.innerHTML;
  };
  /* 살아 있는 페이지의 변경을 기록에 남기기 */
  const commitLive = (label, extra = {}, log, entryId) => {
    const body = serializeLive();
    liveBodyRef.current = body;
    commitDoc((d) => ({
      ...d, body,
      css: extra.css && extra.css.trim() ? `${d.css}\n${extra.css.trim()}` : d.css,
      vars: extra.vars && Object.keys(extra.vars).length ? { ...d.vars, ...extra.vars } : d.vars,
    }), label, entryId);
    if (log) addLog(log);
    bump();
  };

  const scheduleCommit = (key, fn, ms = 450) => {
    const p = pendingCommitRef.current;
    if (p) { clearTimeout(p.timer); if (p.key !== key) { pendingCommitRef.current = null; p.fn(); } }
    const entry = { key, fn, timer: null };
    entry.timer = setTimeout(() => { if (pendingCommitRef.current === entry) pendingCommitRef.current = null; fn(); }, ms);
    pendingCommitRef.current = entry;
  };
  const flushPending = () => {
    const p = pendingCommitRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingCommitRef.current = null;
    p.fn();
  };

  /* 글자 바로 고치기 */
  const endEdit = (commit = true) => {
    const ed = editingRef.current;
    if (!ed) return;
    editingRef.current = null;
    const { el, before, id, onKey, onBlur, onPaste } = ed;
    el.removeEventListener("keydown", onKey);
    el.removeEventListener("blur", onBlur);
    el.removeEventListener("paste", onPaste);
    el.removeAttribute("contenteditable");
    el.removeAttribute("data-pf-editing");
    el.removeAttribute("spellcheck");
    setEditingId(null);
    if (!commit) { el.innerHTML = before; bump(); return; }
    if (el.innerHTML !== before) {
      const t = document.createElement("template");
      t.innerHTML = before;
      commitLive(`글자 수정: ${kindName(el)}`, {}, { source: "direct", category: "copy", target: id, detail: { before: cut(t.content.textContent.trim(), 200), after: cut(el.textContent.trim(), 200) } });
    }
  };
  const textTarget = (el) => {
    const hasOwn = (n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    let t = el;
    while (t && t.getAttribute && t.hasAttribute("data-pf-id") && !hasOwn(t)) t = t.parentElement;
    if (!t || !t.hasAttribute || !t.hasAttribute("data-pf-id")) return el && hasOwn(el) ? el : null;
    while (t.parentElement && t.parentElement.hasAttribute("data-pf-id") && getComputedStyle(t).display === "inline" && hasOwn(t.parentElement)) t = t.parentElement;
    return t;
  };
  const beginEdit = (rawEl, { caretEnd = false } = {}) => {
    const el = rawEl ? textTarget(rawEl) : null;
    if (!el) { toast("글자가 있는 곳을 눌러 주세요"); return; }
    if (editingRef.current && editingRef.current.el === el) return;
    endEdit(true);
    const id = el.getAttribute("data-pf-id");
    const onKey = (e) => {
      e.stopPropagation();
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") { e.preventDefault(); endEdit(false); }
      else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); endEdit(true); }
      else if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); try { document.execCommand("insertLineBreak"); } catch { /* 무시 */ } }
    };
    const onBlur = () => { if (editingRef.current && editingRef.current.el === el) endEdit(true); };
    const onPaste = (e) => { e.preventDefault(); insertPlainText((e.clipboardData || window.clipboardData).getData("text/plain")); };
    editingRef.current = { el, before: el.innerHTML, id, onKey, onBlur, onPaste };
    el.setAttribute("contenteditable", "true");
    el.setAttribute("data-pf-editing", "");
    el.setAttribute("spellcheck", "false");
    el.addEventListener("keydown", onKey);
    el.addEventListener("blur", onBlur);
    el.addEventListener("paste", onPaste);
    setEditingId(id);
    setSelId(id);
    el.focus({ preventScroll: true });
    if (caretEnd) placeCaretEnd(el);
  };

  /* 되돌리기 */
  const undo = () => { endEdit(true); flushPending(); setHist((h) => (h.index > 0 ? { ...h, index: h.index - 1 } : h)); };
  const redo = () => { endEdit(true); flushPending(); setHist((h) => (h.index < h.entries.length - 1 ? { ...h, index: h.index + 1 } : h)); };
  const jumpTo = (i) => { endEdit(true); flushPending(); setHist((h) => ({ ...h, index: clamp(i, 0, h.entries.length - 1) })); };

  const setTool = (t) => {
    if (t !== "text") endEdit(true);
    if (t !== S.current.tool) setHintTool(t);
    setToolState(t);
    setPreview(false);
    setHover(null);
    hoverIdRef.current = null;
    if (MARK_TOOLS.includes(t)) setShowMarks(true);
  };
  const changeDevice = (d) => { setDevice(d); setZoomMode("fit"); setHover(null); hoverIdRef.current = null; };
  const zoomBy = (f) => { setZoomMode("manual"); setManualZoom(clamp(Math.round(zoom * f * 100) / 100, 0.15, 2)); };

  const selectEl = (id) => {
    setSelId(id);
    setChatCtxOff(false);
    if (id && !S.current.narrow && ["feedback", "history"].includes(S.current.panel)) setPanel("inspect");
  };

  /* 표시(주석·영역·펜·화살표) */
  const baseAnn = (type, extra) => ({
    id: uid(), n: null, type, kind: "change", color: S.current.markColor, device: S.current.device, status: "open",
    text: "", category: null, createdAt: Date.now(), targets: [], targetsInfo: [], ...extra,
  });
  const nextNumber = () => S.current.anns.reduce((m, a) => Math.max(m, a.n || 0), 0) + 1;
  const saveFrom = (p, d) => {
    const patch = { kind: d.kind, category: d.category, text: d.text, color: p.ann.color };
    if (p.isNew) {
      const saved = { ...p.ann, ...patch, n: nextNumber(), status: "open" };
      setAnns((l) => [...l, saved]);
      if (["inspect", "history"].includes(S.current.panel)) setPanel("feedback");
      addLog({ source: "annotation", category: d.category, target: p.ann.targets?.[0], detail: { type: p.ann.type, kind: d.kind, text: d.text } });
      return saved;
    }
    const prev = S.current.anns.find((a) => a.id === p.ann.id);
    const changed = prev && prev.text !== d.text;
    const saved = { ...prev, ...patch, ...(changed && prev.status !== "open" ? { status: "open", reply: null } : {}) };
    setAnns((l) => l.map((a) => (a.id === saved.id ? saved : a)));
    return saved;
  };
  const openNew = (ann) => {
    const p = S.current.pending;
    const d = composerDraftRef.current;
    if (p && p.isNew && d && (d.text.trim() || d.kind === "keep")) saveFrom(p, d);
    composerDraftRef.current = null;
    setPending({ ann, isNew: true });
    setSheetOpen(false);
  };
  const openAnn = (a, { scroll = false } = {}) => {
    endEdit(true);
    composerDraftRef.current = null;
    setPending({ ann: a, isNew: false });
    if (scroll) focusAnn(a);
  };
  const closePending = () => { setPending(null); composerDraftRef.current = null; };
  const updateAnn = (id, patch) => setAnns((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const removeAnn = (id) => {
    setAnns((l) => l.filter((a) => a.id !== id));
    if (S.current.pending && S.current.pending.ann.id === id) closePending();
  };
  const toggleResolve = (a) => {
    updateAnn(a.id, { status: a.status === "resolved" ? "open" : "resolved" });
    if (S.current.pending && S.current.pending.ann.id === a.id) closePending();
  };
  const focusAnn = (a) => {
    const g = S.current.geoMap[a.id];
    const c = canvasRef.current, pg = pageRef.current;
    if (!g || !c || !pg) { toast("이 화면 크기에서는 보이지 않는 요소예요"); return; }
    const cr = c.getBoundingClientRect(), pr = pg.getBoundingClientRect(), z = S.current.zoom;
    c.scrollTo({ top: Math.max(0, pr.top - cr.top + c.scrollTop + g.cy * z - c.clientHeight * 0.4), left: Math.max(0, pr.left - cr.left + c.scrollLeft + g.cx * z - c.clientWidth / 2), behavior: "smooth" });
    setFlashId(a.id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1600);
  };

  const startComment = (el, clientX, clientY) => {
    const p = clientX == null ? (() => { const r = rectOf(el); return { x: r.x + Math.min(24, r.w / 2), y: r.y + Math.min(20, r.h / 2) }; })() : toPage(clientX, clientY);
    const A = rectOf(el);
    const id = el.getAttribute("data-pf-id");
    openNew(baseAnn("comment", { anchorId: id, rel: toRel(p, A), geo: p, targets: [id], targetsInfo: [{ id, label: labelOf(el) }] }));
  };
  const finishRegion = (a, b) => {
    const box = normBox(a, b);
    if (box.w < 12 || box.h < 12) { toast("조금 더 크게 드래그해 주세요"); return; }
    const anc = anchorFor(box);
    const t = elementsInBox(box, anc.id);
    openNew(baseAnn("region", {
      anchorId: anc.id,
      rel: { fx: (box.x - anc.rect.x) / anc.rect.w, fy: (box.y - anc.rect.y) / anc.rect.h, fw: box.w / anc.rect.w, fh: box.h / anc.rect.h },
      geo: box, targets: t.ids, targetsInfo: t.info,
    }));
  };
  const buildDraw = (strokes, prev) => {
    const box = bboxOf(strokes.flatMap((s) => s.pts), 6);
    const anc = anchorFor(box);
    const t = elementsInBox(markBox(box), anc.id);
    return {
      ...(prev || baseAnn("draw")),
      anchorId: anc.id,
      strokes: strokes.map((s) => ({ ...s, rel: s.pts.map((p) => toRel(p, anc.rect)) })),
      targets: t.ids, targetsInfo: t.info,
    };
  };
  const finishDraw = (pts) => {
    if (!pts || pts.length < 2) return;
    const stroke = { pts, hl: S.current.highlighter, color: S.current.markColor };
    const p = S.current.pending;
    if (p && p.isNew && p.ann.type === "draw") setPending({ isNew: true, ann: buildDraw([...p.ann.strokes, stroke], p.ann) });
    else openNew(buildDraw([stroke]));
  };
  const finishArrow = (a, b) => {
    if (Math.hypot(b.x - a.x, b.y - a.y) < 18) { toast("출발점에서 도착점까지 끌어 주세요"); return; }
    const e1 = elementAtPage(a.x, a.y), e2 = elementAtPage(b.x, b.y);
    const r1 = e1 ? rectOf(e1) : pageBox(), r2 = e2 ? rectOf(e2) : pageBox();
    const id1 = e1 ? e1.getAttribute("data-pf-id") : null, id2 = e2 ? e2.getAttribute("data-pf-id") : null;
    const info = [e1 && { id: id1, label: `${labelOf(e1)} (출발)` }, e2 && { id: id2, label: `${labelOf(e2)} (도착)` }].filter(Boolean);
    openNew(baseAnn("arrow", {
      anchorId: id1,
      from: { anchorId: id1, rel: toRel(a, r1), geo: a },
      to: { anchorId: id2, rel: toRel(b, r2), geo: b },
      targets: [id1, id2].filter(Boolean), targetsInfo: info,
    }));
  };

  /* 표시용 투명 막 위의 포인터 처리 */
  const onCapDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 일부 환경 */ }
    if (tool === "hand") {
      const c = canvasRef.current;
      dragRef.current = { t: "hand", pid: e.pointerId, x: e.clientX, y: e.clientY, sl: c.scrollLeft, st: c.scrollTop };
      return;
    }
    const p = toPage(e.clientX, e.clientY);
    dragRef.current = { t: tool, pid: e.pointerId, start: p, end: p, pts: [p] };
    setDraft({ t: tool, start: p, end: p, pts: [p] });
  };
  const onCapMove = (e) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    if (d.t === "hand") {
      const c = canvasRef.current;
      c.scrollLeft = d.sl - (e.clientX - d.x);
      c.scrollTop = d.st - (e.clientY - d.y);
      return;
    }
    const p = toPage(e.clientX, e.clientY);
    d.end = p;
    if (d.t === "draw") {
      const l = d.pts[d.pts.length - 1];
      if (Math.hypot(p.x - l.x, p.y - l.y) >= 2 / zoom) d.pts.push(p);
    }
    setDraft({ t: d.t, start: d.start, end: p, pts: d.t === "draw" ? d.pts.slice() : null });
  };
  const onCapUp = (e) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    dragRef.current = null;
    setDraft(null);
    if (d.t === "region") finishRegion(d.start, d.end);
    else if (d.t === "draw") finishDraw(d.pts);
    else if (d.t === "arrow") finishArrow(d.start, d.end);
  };
  const onCapCancel = () => { dragRef.current = null; setDraft(null); };

  /* 요소 직접 다루기 */
  const setElStyle = (id, prop, value) => {
    const el = getEl(id);
    if (!el) return;
    if (value == null) el.style.removeProperty(prop); else el.style.setProperty(prop, String(value));
    bump();
    scheduleCommit("style:" + id, () => commitLive(`스타일: ${kindName(el)}`, {}, { source: "direct", category: "style", target: id, detail: { [prop]: value } }));
  };
  const resetInline = (id) => {
    const el = getEl(id);
    if (!el) return;
    flushPending();
    el.removeAttribute("style");
    commitLive(`스타일 되돌림: ${kindName(el)}`, {}, { source: "direct", category: "style", target: id, detail: "reset" });
  };
  const duplicateEl = (id) => {
    const el = getEl(id);
    if (!el) return;
    endEdit(true); flushPending();
    const c = el.cloneNode(true);
    c.removeAttribute("data-pf-id");
    c.querySelectorAll("[data-pf-id]").forEach((x) => x.removeAttribute("data-pf-id"));
    el.after(c);
    assignIds();
    commitLive(`복제: ${kindName(el)}`, {}, { source: "direct", category: "layout", target: id, detail: "duplicate" });
    setSelId(c.getAttribute("data-pf-id"));
  };
  const deleteEl = (id) => {
    const el = getEl(id);
    if (!el) return;
    endEdit(false); flushPending();
    const name = kindName(el);
    el.remove();
    setSelId(null);
    setHover(null);
    commitLive(`삭제: ${name}`, {}, { source: "direct", category: "layout", target: id, detail: "remove" });
    toast(`${name}을(를) 지웠어요`, { action: "되돌리기", onAction: () => S.current.undo() });
  };
  const moveEl = (id, dir) => {
    const el = getEl(id);
    if (!el) return;
    flushPending();
    let sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
    while (sib && /^(SCRIPT|STYLE)$/.test(sib.tagName)) sib = dir < 0 ? sib.previousElementSibling : sib.nextElementSibling;
    if (!sib) return;
    if (dir < 0) sib.before(el); else sib.after(el);
    commitLive(`순서 변경: ${kindName(el)}`, {}, { source: "direct", category: "layout", target: id, detail: dir < 0 ? "up" : "down" });
  };
  const selectParent = (id) => {
    const el = getEl(id);
    const p = el && el.parentElement ? el.parentElement.closest("[data-pf-id]") : null;
    if (p) setSelId(p.getAttribute("data-pf-id"));
  };

  /* 디자인 토큰·개성 포인트·노브 */
  const setVarLive = (name, value) => {
    liveVarsRef.current = { ...liveVarsRef.current, [name]: value };
    setLiveVars(liveVarsRef.current);
    scheduleCommit("vars", () => {
      const lv = liveVarsRef.current;
      if (!Object.keys(lv).length) return;
      liveVarsRef.current = {};
      setLiveVars({});
      commitDoc((d) => ({ ...d, vars: { ...d.vars, ...lv } }), `디자인 조정: ${Object.keys(lv).map((k) => TOKEN_META[k]?.label || k).join(", ")}`);
      addLog({ source: "tweak", category: "token", detail: lv });
    });
  };
  const resetVar = (name) => {
    flushPending();
    commitDoc((d) => { const v = { ...d.vars }; delete v[name]; return { ...d, vars: v }; }, `원래대로: ${TOKEN_META[name]?.label || name}`);
  };
  const applyPreset = (p) => {
    flushPending();
    const tokens = extractRootVars(S.current.doc.css);
    const vars = Object.fromEntries(Object.entries(p.vars).filter(([k]) => k in tokens));
    if (!Object.keys(vars).length) { toast("이 페이지에는 맞는 디자인 토큰이 없어요"); return; }
    commitDoc((d) => ({ ...d, vars: { ...d.vars, ...vars } }), `분위기: ${p.name}`);
    addLog({ source: "preset", category: "color", detail: p.id });
  };
  const toggleAddon = (id) => {
    flushPending();
    const on = !S.current.doc.addons.includes(id);
    const ad = ADDONS.find((a) => a.id === id);
    commitDoc((d) => ({ ...d, addons: on ? [...d.addons.filter((x) => x !== id), id] : d.addons.filter((x) => x !== id) }), `개성 포인트 ${on ? "켬" : "끔"}: ${ad.name}`);
    addLog({ source: "addon", category: "signature", detail: { id, on } });
  };
  const setKnobLive = (id, value) => {
    liveKnobsRef.current = { ...liveKnobsRef.current, [id]: value };
    setLiveKnobs(liveKnobsRef.current);
    scheduleCommit("knobs", () => {
      const lk = liveKnobsRef.current;
      if (!Object.keys(lk).length) return;
      liveKnobsRef.current = {};
      setLiveKnobs({});
      commitDoc((d) => ({ ...d, knobs: d.knobs.map((k) => (k.id in lk ? { ...k, value: lk[k.id] } : k)) }), "Claude 노브 조정");
      addLog({ source: "knob", category: "style", detail: lk });
    });
  };
  const removeKnobs = (pred, label) => { flushPending(); commitDoc((d) => ({ ...d, knobs: d.knobs.filter((k) => !pred(k)) }), label); };

  /* ── Claude 연결 ── */
  const ai = async (system, prompt) => {
    const mode = system === OPS_SYSTEM ? "ops" : system === CHAT_SYSTEM ? "chat" : system === KNOB_SYSTEM ? "knob" : null;
    if (!mode || !aiCall) throw new Error("Claude에 연결되어 있지 않아요.");
    const r = await aiCall(mode, prompt);
    if (!r?.ok) throw new Error(r?.reason || "Claude 요청이 실패했어요.");
    try { return parseJsonLoose(r.text); } catch {
      throw new Error("Claude 응답을 읽지 못했어요. 한 번 더 시도해 주세요.");
    }
  };
  const snippetOf = (el, n = 900) => cut(el.outerHTML.replace(/\s+/g, " "), n);
  const pageContext = () => {
    const d = S.current.doc;
    const tokens = { ...extractRootVars(d.css), ...d.vars };
    const b = bodyEl();
    return [
      "## 디자인 토큰 (:root)", Object.entries(tokens).map(([k, v]) => `${k}: ${v};`).join("\n") || "(없음)",
      "", "## 켜진 개성 포인트", (d.addons || []).map((id) => ADDONS.find((a) => a.id === id)?.name).join(", ") || "(없음)",
      "", "## 페이지 구조 (data-pf-id 태그.클래스 \"직접 들어 있는 글자\")", b ? outline(b) : "",
      "", "## 페이지 CSS", cut(d.css, 6500),
    ].join("\n");
  };
  const keepSection = () => {
    const keep = S.current.anns.filter((x) => x.kind === "keep");
    if (!keep.length) return "";
    return ["", "## KEEP (바꾸지 말 것)", ...keep.flatMap((k) => (k.targets || []).map((id) => `[${id}] ${k.text || "사용자가 마음에 들어 하는 부분"}`))].join("\n");
  };
  const applyOpsLive = (ops) => {
    const root = shadowRef.current;
    const keep = new Set(S.current.anns.filter((a) => a.kind === "keep").flatMap((a) => a.targets || []));
    return applyOps(ops, { find: (id) => root.querySelector(`[data-pf-id="${cssId(id)}"]`), assign: assignIds, keep });
  };
  const buildAnnPrompt = (a) => {
    const dev = DEVICES[a.device] || DEVICES.desktop;
    const lines = [`## 수정 요청 #${a.n}`, `표시 방식: ${TYPE_DESC[a.type]}`];
    if (a.category) lines.push(`분류: ${CAT_LABEL[a.category]}`);
    if (a.type === "draw") lines.push(`펜 모양: ${describeStrokes(a.strokes)}`);
    lines.push(`요청 내용: ${a.text}`, `표시한 화면: ${dev.label} (${dev.w}px 너비)`, "", "## 대상 요소");
    let found = 0;
    for (const id of a.targets || []) {
      const el = getEl(id);
      if (el) { found++; lines.push(`[${id}] ${snippetOf(el)}`); }
    }
    if (!found) lines.push("(표시했던 요소가 사라졌어요. 페이지 구조를 보고 위치를 판단하세요.)");
    if (a.type === "arrow") {
      const f = getEl(a.from.anchorId), t = getEl(a.to.anchorId);
      lines.push("", `화살표 출발: ${f ? `[${a.from.anchorId}] ${techLabel(f)}` : "빈 곳"}`, `화살표 도착: ${t ? `[${a.to.anchorId}] ${techLabel(t)}` : "빈 곳"}`);
    }
    return lines.join("\n") + keepSection() + "\n\n" + pageContext();
  };

  /* 표시들을 차례로 Claude에게 맡겨 반영 */
  const applyAnnotations = async (list) => {
    if (S.current.busy) return;
    endEdit(true); flushPending();
    const queue = list.filter((a) => a.kind !== "keep" && a.text.trim() && a.status !== "resolved");
    if (!queue.length) { toast("반영할 수정 요청이 없어요"); return; }
    closePending();
    let ok = 0;
    for (let i = 0; i < queue.length; i++) {
      const a = queue[i];
      setBusy({ label: `#${a.n} 반영 중${queue.length > 1 ? ` (${i + 1}/${queue.length})` : ""}` });
      updateAnn(a.id, { status: "applying" });
      try {
        const json = await ai(OPS_SYSTEM, buildAnnPrompt(a));
        const rep = applyOpsLive(json.ops);
        if (!rep.applied) throw new Error(rep.skipped[0] ? `바꿀 곳을 찾지 못했어요 (${rep.skipped[0]})` : "바뀐 내용이 없었어요. 메모를 조금 더 구체적으로 적어 주세요.");
        const entryId = uid();
        commitLive(`Claude: #${a.n} 반영`, { css: rep.css, vars: rep.vars }, { source: "claude-annotation", category: a.category, target: a.targets?.[0], detail: { type: a.type, request: a.text, summary: json.summary, ops: rep.applied } }, entryId);
        updateAnn(a.id, { status: "applied", appliedEntryId: entryId, reply: json.summary || "반영했어요", appliedAt: Date.now() });
        ok++;
      } catch (err) {
        updateAnn(a.id, { status: "failed", reply: err.message });
      }
    }
    setBusy(null);
    toast(ok === queue.length ? `${ok}개를 반영했어요. 마음에 안 들면 되돌리기를 누르세요` : `${queue.length}개 중 ${ok}개를 반영했어요. 실패한 메모를 확인해 주세요`);
  };

  const sendChat = async (text) => {
    if (S.current.busy) return;
    endEdit(true); flushPending();
    const ctxId = !chatCtxOff ? S.current.selId : null;
    const el = getEl(ctxId);
    setChat((c) => [...c, { id: uid(), role: "user", text, ctx: el ? `선택: ${labelOf(el)}` : null, time: Date.now() }]);
    setBusy({ label: "Claude가 고치는 중" });
    try {
      const past = S.current.chat.slice(-6).map((m) => `${m.role === "user" ? "사용자" : "Claude"}: ${m.text}`).join("\n");
      const prompt = [past ? `## 이전 대화\n${past}\n` : "", `## 이번 요청\n${text}`, el ? `\n## 선택한 요소\n[${ctxId}] ${snippetOf(el, 1400)}` : "", keepSection(), "", pageContext()].join("\n");
      const json = await ai(CHAT_SYSTEM, prompt);
      const rep = applyOpsLive(json.ops || []);
      if (rep.applied) commitLive(`Claude 대화: ${cut(text, 16)}`, { css: rep.css, vars: rep.vars }, { source: "claude-chat", target: ctxId, detail: { request: text, reply: json.reply, ops: rep.applied } });
      setChat((c) => [...c, { id: uid(), role: "assistant", text: json.reply || json.summary || (rep.applied ? "반영했어요." : "바꿀 부분을 찾지 못했어요."), changes: rep.applied, time: Date.now() }]);
    } catch (err) {
      setChat((c) => [...c, { id: uid(), role: "assistant", text: err.message, error: true, time: Date.now() }]);
    } finally {
      setBusy(null);
    }
  };

  const generateKnobs = async (scopeId) => {
    if (S.current.busy) return;
    flushPending();
    const el = getEl(scopeId);
    const group = el ? labelOf(el) : "페이지 전체";
    setBusy({ label: "노브 만드는 중" });
    try {
      let prompt;
      if (el) {
        const cs = getComputedStyle(el);
        prompt = [`## 대상 요소\n[${scopeId}] ${snippetOf(el, 1000)}`, `\n## 현재 계산된 스타일\n${KNOB_PROPS.map((p) => `${p}: ${cs.getPropertyValue(p)}`).join("\n")}`, `\n## 디자인 토큰\n${Object.entries({ ...extractRootVars(S.current.doc.css), ...S.current.doc.vars }).map(([k, v]) => `${k}: ${v};`).join("\n")}`].join("\n");
      } else prompt = `## 페이지 전체용 노브를 만들어 주세요\n\n${pageContext()}`;
      const json = await ai(KNOB_SYSTEM, prompt);
      const knobs = sanitizeKnobs(json.knobs, group);
      if (!knobs.length) throw new Error("쓸 수 있는 노브를 받지 못했어요. 다시 시도해 주세요.");
      commitDoc((d) => ({ ...d, knobs: [...(d.knobs || []), ...knobs] }), `Claude 노브 ${knobs.length}개: ${cut(group, 14)}`);
      addLog({ source: "knob-create", target: scopeId, detail: knobs.map((k) => k.label) });
      toast(`노브 ${knobs.length}개를 만들었어요`);
    } catch (err) {
      toast(err.message, { ms: 5000 });
    } finally {
      setBusy(null);
    }
  };

  const askClaudeAbout = (id) => { setSelId(id); setChatCtxOff(false); setPanel("chat"); if (S.current.narrow) setSheetOpen(true); };

  /* 불러오기·내보내기 */
  const resetSession = (d, label) => {
    endEdit(false);
    const p = pendingCommitRef.current;
    if (p) { clearTimeout(p.timer); pendingCommitRef.current = null; }
    liveBodyRef.current = null;
    idSeqRef.current = 0;
    liveVarsRef.current = {}; liveKnobsRef.current = {};
    setLiveVars({}); setLiveKnobs({});
    setHist({ entries: [{ id: uid(), doc: d, label, time: Date.now() }], index: 0 });
    setAnns([]); setChat([]); setEditLog([]); setPending(null); setSelId(null); setHover(null); setModal(null);
  };
  const importHtml = (html) => {
    let d;
    try { d = parseHtml(html); } catch { toast("HTML을 읽지 못했어요"); return; }
    if (!d.body.trim()) { toast("body 안에 내용이 없어요"); return; }
    resetSession(d, "불러온 초안");
    toast("초안을 불러왔어요");
  };
  const getExportHtml = (keepIds) => buildExportHtml(S.current.doc, { keepIds });
  const getHandoff = () => buildHandoff(S.current.doc, S.current.anns);
  const getJson = () => JSON.stringify({
    app: "blue-pencil", version: 1, exportedAt: new Date().toISOString(), title: S.current.doc.title,
    tokens: { ...extractRootVars(S.current.doc.css), ...S.current.doc.vars }, addons: S.current.doc.addons, knobs: S.current.doc.knobs,
    annotations: S.current.anns.map(({ strokes, rel, geo: g, from, to, ...rest }) => ({ ...rest, shape: rest.type === "draw" ? describeStrokes(strokes) : undefined })),
    editLog: S.current.editLog,
  }, null, 2);

  const followHash = (href) => {
    const c = canvasRef.current;
    if (!c || !href || !href.startsWith("#")) return;
    const t = href.length > 1 ? shadowRef.current.getElementById(decodeURIComponent(href.slice(1))) : null;
    if (!t) { c.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const r = t.getBoundingClientRect(), cr = c.getBoundingClientRect();
    c.scrollTo({ top: c.scrollTop + r.top - cr.top - 12, behavior: "smooth" });
  };
  const escape = () => {
    if (S.current.pending) closePending();
    else if (editingRef.current) endEdit(false);
    else if (S.current.selId) setSelId(null);
    else if (S.current.preview) setPreview(false);
    else if (S.current.sheetOpen) setSheetOpen(false);
    else setTool("select");
  };

  /* ── 효과 ── */

  /* 크기 관찰 */
  useLayoutEffect(() => {
    const ro = new ResizeObserver((es) => {
      for (const e of es) {
        if (e.target === rootRef.current) setRootW(Math.round(e.contentRect.width));
        else if (e.target === canvasRef.current) setCanvasW(Math.round(e.contentRect.width));
      }
    });
    if (rootRef.current) ro.observe(rootRef.current);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  /* Shadow DOM 준비 */
  useLayoutEffect(() => {
    const host = hostRef.current;
    const root = host.shadowRoot || host.attachShadow({ mode: "open" });
    if (!root.querySelector(".pf-frame")) {
      root.innerHTML = `<style data-s="base"></style><style data-s="src"></style><style data-s="vars"></style><style data-s="addons"></style><style data-s="knobs"></style><style data-s="ui"></style><div class="pf-frame"><div class="pf-html"><div class="pf-body"></div></div></div>`;
      root.querySelector('style[data-s="base"]').textContent = SHADOW_BASE_CSS;
    }
    shadowRef.current = root;
    const frame = root.querySelector(".pf-frame");
    const ro = new ResizeObserver(() => { setPageH(Math.max(200, Math.ceil(frame.offsetHeight))); setLayoutTick((t) => t + 1); });
    ro.observe(frame);
    return () => ro.disconnect();
  }, []);

  /* 문서를 페이지에 그리기 */
  useLayoutEffect(() => {
    const root = shadowRef.current;
    if (!root) return;
    const set = (k, css) => { const s = root.querySelector(`style[data-s="${k}"]`); if (s && s.textContent !== css) s.textContent = css; };
    set("src", srcCss); set("vars", varsCss); set("addons", addonsCss); set("knobs", knobsCss);
    const b = root.querySelector(".pf-body");
    if (doc.body !== liveBodyRef.current) {
      if (editingRef.current) { const ed = editingRef.current; editingRef.current = null; ed.el.removeEventListener("blur", ed.onBlur); setEditingId(null); }
      b.innerHTML = doc.body;
      liveBodyRef.current = doc.body;
      syncIdSeq();
    }
    const cls = (doc.bodyAttrs || []).find(([n]) => n === "class");
    b.className = ("pf-body " + (cls ? cls[1] : "")).trim();
    (doc.bodyAttrs || []).forEach(([n, v]) => { if (n !== "class" && n !== "style") b.setAttribute(n, v); });
    root.querySelector(".pf-html").setAttribute("lang", doc.lang || "ko");
    setLayoutTick((t) => t + 1);
  }, [doc, srcCss, varsCss, addonsCss, knobsCss]);

  /* 글꼴 */
  useEffect(() => { ensureHeadLink(FONTS_URL); }, []);
  useEffect(() => {
    hoistFonts(doc);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setLayoutTick((t) => t + 1)).catch(() => {});
  }, [doc.css, doc.links]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 도구별 커서 */
  useEffect(() => {
    const root = shadowRef.current;
    if (!root) return;
    const cur = preview ? "" : tool === "text" ? "text" : tool === "comment" ? "crosshair" : tool === "select" ? "default" : "";
    const s = root.querySelector('style[data-s="ui"]');
    s.textContent = SHADOW_UI_CSS + (cur ? `.pf-frame,.pf-frame *{cursor:${cur} !important}` : "");
  }, [tool, preview]);

  /* 도구 안내는 잠깐만 */
  useEffect(() => {
    if (!hintTool) return undefined;
    const t = setTimeout(() => setHintTool(null), 3800);
    return () => clearTimeout(t);
  }, [hintTool]);

  /* 페이지 안의 클릭·호버 (Shadow DOM 이벤트) */
  useEffect(() => {
    const host = hostRef.current;
    const root = shadowRef.current;
    const pick = (e) => {
      for (const n of e.composedPath()) {
        if (n === host) break;
        if (n.nodeType === 1 && n.hasAttribute && n.hasAttribute("data-pf-id")) return n;
      }
      return null;
    };
    const onMove = (e) => {
      const s = S.current;
      if (s.preview || e.pointerType === "touch" || !["select", "comment", "text"].includes(s.tool) || dragRef.current) return;
      const el = pick(e);
      const id = el ? el.getAttribute("data-pf-id") : null;
      if (id === hoverIdRef.current) return;
      hoverIdRef.current = id;
      setHover(id && id !== s.selId && id !== s.editingId ? { id, rect: rectOf(el), label: labelOf(el) } : null);
    };
    const onLeave = () => { hoverIdRef.current = null; setHover(null); };
    const onClick = (e) => {
      const path = e.composedPath();
      const link = path.find((n) => n.tagName === "A" && n.getAttribute && n.getAttribute("href") != null);
      if (link || path.some((n) => n.tagName === "BUTTON" || n.tagName === "LABEL")) e.preventDefault();
      const s = S.current;
      if (s.preview) { if (link) s.followHash(link.getAttribute("href")); return; }
      if (editingRef.current && path.includes(editingRef.current.el)) return;
      const el = pick(e);
      if (s.tool === "select") {
        if (s.pending) s.closePending();
        s.selectEl(el ? el.getAttribute("data-pf-id") : null);
      } else if (s.tool === "comment" && el) s.startComment(el, e.clientX, e.clientY);
    };
    const onDbl = (e) => {
      const s = S.current;
      if (s.preview || s.tool !== "select") return;
      const el = pick(e);
      if (el) { e.preventDefault(); s.beginEdit(el, { caretEnd: true }); }
    };
    const onDown = (e) => {
      const s = S.current;
      if (s.preview || s.tool !== "text") return;
      const el = pick(e);
      if (!el) { s.endEdit(true); return; }
      if (editingRef.current && editingRef.current.el.contains(el)) return;
      s.beginEdit(el);
    };
    const stop = (e) => e.preventDefault();
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("click", onClick);
    host.addEventListener("dblclick", onDbl);
    host.addEventListener("pointerdown", onDown);
    root.addEventListener("submit", stop, true);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("click", onClick);
      host.removeEventListener("dblclick", onDbl);
      host.removeEventListener("pointerdown", onDown);
      root.removeEventListener("submit", stop, true);
    };
  }, []);

  /* 단축키 (한글 입력 상태에서도 동작하도록 e.code 사용) */
  useEffect(() => {
    const typing = (e) => {
      const t = e.composedPath ? e.composedPath()[0] : e.target;
      return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ""));
    };
    const onKey = (e) => {
      const s = S.current;
      if (typing(e) || s.modal) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.code === "KeyZ") { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); return; }
      if (mod && e.code === "KeyY") { e.preventDefault(); s.redo(); return; }
      if (mod || e.altKey) return;
      if (e.key === "Escape") { s.escape(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && s.selId && s.tool === "select") { e.preventDefault(); s.deleteEl(s.selId); return; }
      if (e.code === "Space") {
        const t = e.composedPath()[0];
        if (t && t.tagName === "BUTTON") return;
        e.preventDefault();
        if (!e.repeat && s.tool !== "hand") { spaceToolRef.current = s.tool; s.setTool("hand"); }
        return;
      }
      const t = TOOLS.find((x) => "Key" + x.key === e.code);
      if (t) s.setTool(t.id);
    };
    const onUp = (e) => {
      if (e.code === "Space" && spaceToolRef.current) { const t = spaceToolRef.current; spaceToolRef.current = null; S.current.setTool(t); }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp); };
  }, []);

  /* 표시·선택·메모 카드의 위치 계산 */
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!shadowRef.current || !page) return;
    const pb = { x: 0, y: 0, w: devW, h: pageH };
    const lookup = (id) => {
      if (!id) return pb;
      const el = getEl(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return HIDDEN;
      return rectOf(el);
    };
    const map = {};
    for (const a of markList) {
      const g = resolveGeo(a, lookup);
      if (g) map[a.id] = g;
    }
    let sel = null;
    const sEl = selId ? getEl(selId) : null;
    if (sEl && sEl.isConnected) {
      const r = sEl.getBoundingClientRect();
      if (r.width || r.height) sel = { ...rectOf(sEl), label: labelOf(sEl) };
    }
    let comp = null;
    if (pending && !narrow && map[pending.ann.id] && stageRef.current && canvasRef.current) {
      const g = map[pending.ann.id];
      const s = stageRef.current.getBoundingClientRect(), p = page.getBoundingClientRect(), c = canvasRef.current;
      const W = 316;
      const visR = c.scrollLeft + c.clientWidth - 12;
      let left = p.left - s.left + g.ax * zoom + 12;
      if (left + W > visR) left = p.left - s.left + g.lx * zoom - W - 12;
      left = clamp(left, c.scrollLeft + 10, Math.max(c.scrollLeft + 10, visR - W));
      let top = p.top - s.top + g.ay * zoom - 8;
      if (c.clientHeight > 460) top = clamp(top, c.scrollTop + 10, c.scrollTop + c.clientHeight - 430);
      comp = { left, top: Math.max(10, top) };
    }
    setGeo({ map, sel, comp });
  }, [markList, pending, selId, layoutTick, zoom, devW, pageH, narrow]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 이어서 열기 (claude.ai 아티팩트 저장소가 있을 때만) */
  useEffect(() => {
    let alive = true;
    const st = typeof window !== "undefined" ? window.storage : null;
    if (initialHtml || !st || !st.get) { storageReadyRef.current = true; return undefined; }
    (async () => {
      try {
        const r = await st.get(STORAGE_KEY, false);
        const s = r && r.value ? JSON.parse(r.value) : null;
        if (alive && s && s.doc && typeof s.doc.body === "string") {
          resetSession(s.doc, "이어서 열기");
          setAnns(Array.isArray(s.anns) ? s.anns.map((a) => (a.status === "applying" ? { ...a, status: "open" } : a)) : []);
          setChat(Array.isArray(s.chat) ? s.chat : []);
          setEditLog(Array.isArray(s.editLog) ? s.editLog : []);
          toast("지난 작업을 이어서 열었어요", { action: "예시로 새로 시작", onAction: () => S.current.resetSession(parseHtml(SAMPLE_HTML), "AI 초안") });
        }
      } catch { /* 저장된 작업 없음 */ }
      storageReadyRef.current = true;
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* 자동 저장과 onChange 알림 */
  useEffect(() => {
    const t = setTimeout(() => {
      if (onChange) { try { onChange({ html: buildExportHtml(doc), annotations: anns, editLog, doc }); } catch { /* 호출 쪽 오류 무시 */ } }
      const st = typeof window !== "undefined" ? window.storage : null;
      if (!initialHtml && st && st.set && storageReadyRef.current) {
        try {
          const saving = st.set(STORAGE_KEY, JSON.stringify({ v: 1, doc, anns, chat: chat.slice(-30), editLog: editLog.slice(-300), savedAt: Date.now() }), false);
          if (saving && saving.catch) saving.catch(() => {});
        } catch { /* 저장 실패는 조용히 */ }
      }
    }, 900);
    return () => clearTimeout(t);
  }, [doc, anns, chat, editLog]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 최신 값을 이벤트 처리기에서 쓰도록 보관 */
  S.current = {
    tool, preview, zoom, devW, pageH, selId, editingId, pending, anns, busy, doc, chat, editLog, narrow, markColor,
    highlighter, device, panel, sheetOpen, modal, geoMap: geo.map,
    undo, redo, setTool, beginEdit, endEdit, selectEl, startComment, followHash, escape, deleteEl, closePending, resetSession,
  };

  /* ── 패널 ── */
  const TABS = [
    { id: "feedback", label: "피드백", Icon: MessageSquare, count: openAnns.length },
    { id: "tweaks", label: "조정", Icon: SlidersHorizontal },
    { id: "inspect", label: "요소", Icon: Layers },
    { id: "chat", label: "Claude", Icon: Sparkles },
    { id: "history", label: "기록", Icon: History },
  ];
  const tabs = (
    <div className="bp-tabs" role="tablist">
      {TABS.map((t) => (
        <button key={t.id} role="tab" className="bp-tab" aria-selected={panel === t.id} onClick={() => setPanel(t.id)}>
          <t.Icon size={17} />{t.label}
          {t.count ? <span className="bp-tab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );

  const renderFeedback = () => {
    const shown = anns.filter((a) => {
      const st = annStatus(a);
      if (filter === "open") return a.kind !== "keep" && ["open", "failed", "reverted", "applying"].includes(st);
      if (filter === "applied") return st === "applied";
      if (filter === "keep") return a.kind === "keep";
      return true;
    }).slice().reverse();
    return (
      <>
        <div className="bp-panel">
          {anns.length === 0 ? (
            <div className="bp-empty">
              <p className="bp-empty-title">고칠 곳을 페이지 위에 바로 표시해 보세요</p>
              <ul className="bp-howto">
                <li><span className="bp-howto-ic"><MessageSquarePlus size={15} /></span>요소를 눌러 주석 달기{!narrow ? <kbd>C</kbd> : null}</li>
                <li><span className="bp-howto-ic"><SquareDashedMousePointer size={15} /></span>드래그해서 영역 지정{!narrow ? <kbd>R</kbd> : null}</li>
                <li><span className="bp-howto-ic"><PenLine size={15} /></span>펜으로 동그라미·밑줄 긋기{!narrow ? <kbd>P</kbd> : null}</li>
                <li><span className="bp-howto-ic"><MoveUpRight size={15} /></span>옮길 곳을 화살표로{!narrow ? <kbd>A</kbd> : null}</li>
              </ul>
              <p>표시마다 메모를 적고 <b>반영하기</b>를 누르면 Claude가 차례로 고쳐요. 마음에 드는 부분은 “이건 좋아요”로 남기면 건드리지 않아요.</p>
            </div>
          ) : (
            <>
              <div className="bp-seg full bp-filter" role="group" aria-label="보기">
                {[["all", "전체"], ["open", "대기"], ["applied", "반영됨"], ["keep", "좋아요"]].map(([id, l]) => (
                  <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{l}</button>
                ))}
              </div>
              {shown.length === 0 ? <p className="bp-muted">여기에 해당하는 표시가 없어요.</p> : null}
              <ul className="bp-annlist">
                {shown.map((a) => {
                  const st = annStatus(a);
                  const Ic = TYPE_ICON[a.type];
                  const hidden = !geo.map[a.id];
                  return (
                    <li key={a.id} className={`bp-ann ${pending && pending.ann.id === a.id ? "cur" : ""}`} onClick={() => { if (narrow) setSheetOpen(false); openAnn(a, { scroll: true }); }}>
                      <span className={`bp-ann-n ${st === "applied" ? "done" : ""}`} style={{ "--pc": colorOf(a) }}>{a.n}</span>
                      <div className="bp-ann-body">
                        <div className="bp-ann-meta">
                          <Ic size={13} />{TYPE_LABEL[a.type]}
                          {a.category ? <span className="bp-tag">{CAT_LABEL[a.category]}</span> : null}
                          {a.kind === "keep" ? <span className="bp-status keep">유지</span> : <span className={`bp-status ${st}`}>{STATUS_LABEL[st]}</span>}
                        </div>
                        <p className={`bp-ann-text ${a.text ? "" : "empty"}`}>{a.text || "메모 없음"}</p>
                        {a.reply ? <p className="bp-ann-reply"><Sparkles size={12} />{a.reply}</p> : null}
                        <span className="bp-ann-target">{hidden ? "이 화면 크기에서는 보이지 않는 요소예요" : (a.targetsInfo || [])[0]?.label || "페이지"}{a.device !== device ? `, ${DEVICES[a.device]?.label}에서 표시함` : ""}</span>
                      </div>
                      <div className="bp-ann-actions" onClick={(e) => e.stopPropagation()}>
                        {a.kind !== "keep" && ["open", "failed", "reverted"].includes(st) ? <button className="bp-ib sm" title="이것만 반영" aria-label={`#${a.n} 반영`} disabled={!!busy} onClick={() => applyAnnotations([a])}><Sparkles size={15} /></button> : null}
                        {a.kind !== "keep" ? <button className="bp-ib sm" title={a.status === "resolved" ? "다시 열기" : "해결로 표시"} aria-label={a.status === "resolved" ? "다시 열기" : "해결로 표시"} onClick={() => toggleResolve(a)}><CircleCheck size={15} /></button> : null}
                        <button className="bp-ib sm" title="삭제" aria-label={`#${a.n} 삭제`} onClick={() => removeAnn(a.id)}><Trash2 size={15} /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
        <div className="bp-panel-foot">
          <button className="bp-btn" onClick={() => setModal({ type: "export", tab: "handoff" })} disabled={!anns.length}><Copy size={15} />요청서</button>
          <button className="bp-btn primary" disabled={!openAnns.length || !!busy} onClick={() => applyAnnotations(openAnns)}><Sparkles size={15} />{openAnns.length ? `대기 ${openAnns.length}개 반영하기` : "반영할 메모 없음"}</button>
        </div>
      </>
    );
  };

  const renderTweaks = () => {
    const base = extractRootVars(doc.css);
    const cur = { ...base, ...effVars };
    const names = Object.keys(base);
    const groups = { color: [], type: [], shape: [], other: [] };
    names.forEach((n) => {
      const kind = tokenKind(n, cur[n]);
      const g = TOKEN_META[n]?.group || (kind === "color" ? "color" : kind === "font" ? "type" : kind === "number" ? "shape" : "other");
      groups[g].push(n);
    });
    const hex = (k) => { let v = cur[k]; const m = v && String(v).match(/^var\((--[\w-]+)\)$/); if (m) v = cur[m[1]]; return v ? toHex(v) : null; };
    const checks = [];
    if (hex("--text") && hex("--bg")) checks.push({ label: "본문 글자", r: contrastRatio(hex("--text"), hex("--bg")), min: 4.5 });
    if (hex("--muted") && hex("--bg")) checks.push({ label: "보조 글자", r: contrastRatio(hex("--muted"), hex("--bg")), min: 4.5 });
    if (hex("--accent") && hex("--accent-ink")) checks.push({ label: "강조 버튼 글자", r: contrastRatio(hex("--accent-ink"), hex("--accent")), min: 4.5 });
    const row = (n) => <TokenRow key={n} name={n} value={cur[n]} onChange={(v) => setVarLive(n, v)} onReset={n in doc.vars || n in liveVars ? () => resetVar(n) : undefined} />;
    const selEl = selId ? getEl(selId) : null;
    const knobGroups = [];
    effKnobs.forEach((k) => { let g = knobGroups.find((x) => x[0] === k.group); if (!g) { g = [k.group, []]; knobGroups.push(g); } g[1].push(k); });
    return (
      <div className="bp-panel">
        <Section title="분위기 한 번에 바꾸기">
          <div className="bp-presets">
            {PRESETS.map((p) => (
              <button key={p.id} className="bp-preset" onClick={() => applyPreset(p)}>
                <span className="bp-dots">{["--bg", "--surface", "--accent", "--text"].map((k) => <i key={k} style={{ background: p.vars[k] }} />)}</span>
                <b style={{ fontFamily: p.vars["--font-head"] }}>{p.name}</b>
              </button>
            ))}
          </div>
        </Section>
        {names.length === 0 ? (
          <Section title="디자인 토큰"><p className="bp-muted">이 페이지는 CSS 변수(:root)를 쓰지 않아서 토큰 슬라이더가 없어요. 아래 Claude 노브로 조절 장치를 만들어 보세요.</p></Section>
        ) : (
          <>
            {groups.color.length ? (
              <Section title="색">
                {groups.color.map(row)}
                {checks.length ? (
                  <div className="bp-checks" aria-label="글자 대비 점검">
                    {checks.map((c) => (
                      <div key={c.label} className={`bp-check ${c.r >= c.min ? "ok" : "bad"}`}>{c.label}<b>{c.r.toFixed(1)} : 1</b><em>{c.r >= c.min ? "읽기 좋아요" : "대비 부족"}</em></div>
                    ))}
                  </div>
                ) : null}
              </Section>
            ) : null}
            {groups.type.length ? <Section title="글자">{groups.type.map(row)}</Section> : null}
            {groups.shape.length ? <Section title="모양과 여백">{groups.shape.map(row)}</Section> : null}
            {groups.other.length ? <Section title="기타">{groups.other.map(row)}</Section> : null}
          </>
        )}
        <Section title="개성 포인트" aside={`${doc.addons.length}개 켜짐`}>
          <p className="bp-muted" style={{ marginBottom: 8 }}>눌러서 켜고 끌 수 있어요. 한두 가지만 켜야 인상이 또렷해요.</p>
          <div className="bp-addons">
            {ADDONS.map((ad) => (
              <button key={ad.id} className="bp-addon" aria-pressed={doc.addons.includes(ad.id)} onClick={() => toggleAddon(ad.id)}><b>{ad.name}</b><span>{ad.desc}</span></button>
            ))}
          </div>
          {doc.addons.length > 3 ? <p className="bp-warn"><TriangleAlert size={13} />개성 포인트가 {doc.addons.length}개예요. 1~3개일 때 가장 선명하게 기억돼요.</p> : null}
        </Section>
        <Section title="Claude 노브">
          <p className="bp-muted" style={{ marginBottom: 8 }}>{selEl ? `선택한 ${kindName(selEl)}에` : "페이지 전체에"} 맞는 조절 슬라이더를 Claude가 만들어요.{selEl ? "" : " 요소를 선택하면 그 요소 전용으로 만들어요."}</p>
          <button className="bp-btn full" disabled={!!busy} onClick={() => generateKnobs(selEl ? selId : null)}><Wand2 size={15} />{selEl ? `${kindName(selEl)} 노브 만들기` : "페이지 노브 만들기"}</button>
          {knobGroups.map(([g, ks]) => (
            <div key={g} className="bp-knobgroup">
              <div className="bp-knobgroup-head"><b>{cut(g, 26)}</b><button className="bp-link" onClick={() => removeKnobs((k) => k.group === g, "노브 지움")}>지우기</button></div>
              {ks.map((k) => <KnobRow key={k.id} k={k} onChange={(v) => setKnobLive(k.id, v)} onRemove={() => removeKnobs((x) => x.id === k.id, `노브 지움: ${k.label}`)} />)}
            </div>
          ))}
        </Section>
      </div>
    );
  };

  const renderInspect = () => {
    const el = selId ? getEl(selId) : null;
    if (!el || !el.isConnected) {
      return (
        <div className="bp-panel">
          <div className="bp-empty">
            <p className="bp-empty-title">요소를 선택해 보세요</p>
            <p>선택 도구로 글자, 버튼, 카드를 누르면 여기서 크기와 색을 바로 바꿀 수 있어요. 두 번 누르면 글자를 고쳐요.</p>
            <button className="bp-btn" onClick={() => setTool("select")}><MousePointer2 size={15} />선택 도구로</button>
          </div>
        </div>
      );
    }
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize) || 16;
    const lh = cs.lineHeight === "normal" ? 1.2 : round(parseFloat(cs.lineHeight) / fs, 2);
    const crumbs = [];
    let c = el;
    while (c && c.hasAttribute && c.hasAttribute("data-pf-id") && crumbs.length < 5) { crumbs.unshift(c); c = c.parentElement; }
    const st = (prop, v) => setElStyle(selId, prop, v);
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    let prev = el.previousElementSibling, next = el.nextElementSibling;
    return (
      <div className="bp-panel">
        <div className="bp-crumbs">
          {crumbs.map((n) => { const id = n.getAttribute("data-pf-id"); return <button key={id} aria-current={id === selId} onClick={() => setSelId(id)}>{kindName(n)}</button>; })}
        </div>
        <div className="bp-insp-title"><b>{kindName(el)}</b>{text ? <span>{cut(text, 60)}</span> : null}</div>
        <div className="bp-actions">
          <button className="bp-btn sm" onClick={() => beginEdit(el, { caretEnd: true })}><Type size={14} />글자 고치기</button>
          <button className="bp-btn sm" onClick={() => { setTool("comment"); startComment(el); }}><MessageSquarePlus size={14} />주석</button>
          <button className="bp-btn sm" onClick={() => askClaudeAbout(selId)}><Sparkles size={14} />Claude에게</button>
        </div>
        <Section title="글자">
          <RangeRow label="크기" value={round(fs, 1)} min={8} max={Math.max(120, Math.ceil(fs))} step={1} unit="px" onChange={(v) => st("font-size", `${v}px`)} />
          <div className="bp-row">
            <span className="bp-row-label">굵기</span>
            <select className="bp-select" value={String(Math.round(parseFloat(cs.fontWeight) / 100) * 100)} onChange={(e) => st("font-weight", e.target.value)} aria-label="굵기">
              {["300", "400", "500", "600", "700", "800", "900"].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <ColorRow label="글자 색" value={toHex(cs.color)} onChange={(v) => v && st("color", v)} />
          <div className="bp-row">
            <span className="bp-row-label">정렬</span>
            <div className="bp-seg" role="group" aria-label="정렬">
              {[["left", AlignLeft, "왼쪽"], ["center", AlignCenter, "가운데"], ["right", AlignRight, "오른쪽"]].map(([v, Ic, l]) => (
                <button key={v} aria-pressed={cs.textAlign === v || (v === "left" && cs.textAlign === "start")} onClick={() => st("text-align", v)} aria-label={`${l} 정렬`}><Ic size={14} /></button>
              ))}
            </div>
          </div>
          <RangeRow label="줄 간격" value={lh} min={0.9} max={2.6} step={0.05} onChange={(v) => st("line-height", String(v))} />
        </Section>
        <Section title="상자">
          <ColorRow label="배경" value={toHex(cs.backgroundColor)} allowNone onChange={(v) => st("background-color", v || "transparent")} />
          <RangeRow label="안쪽 여백" value={parseFloat(cs.paddingTop) || 0} min={0} max={120} unit="px" onChange={(v) => st("padding", `${v}px`)} />
          <RangeRow label="모서리" value={parseFloat(cs.borderTopLeftRadius) || 0} min={0} max={64} unit="px" onChange={(v) => st("border-radius", `${v}px`)} />
          <RangeRow label="불투명도" value={round(parseFloat(cs.opacity), 2)} min={0} max={1} step={0.05} onChange={(v) => st("opacity", String(v))} />
        </Section>
        <Section title="정리">
          <div className="bp-actions">
            <button className="bp-btn sm" disabled={!prev} onClick={() => moveEl(selId, -1)}><ArrowUp size={14} />앞으로</button>
            <button className="bp-btn sm" disabled={!next} onClick={() => moveEl(selId, 1)}><ArrowDown size={14} />뒤로</button>
            <button className="bp-btn sm" onClick={() => duplicateEl(selId)}><CopyPlus size={14} />복제</button>
            <button className="bp-btn sm danger" onClick={() => deleteEl(selId)}><Trash2 size={14} />삭제</button>
          </div>
          {el.getAttribute("style") ? <button className="bp-link" style={{ marginTop: 6 }} onClick={() => resetInline(selId)}><RotateCcw size={13} />직접 바꾼 스타일 되돌리기</button> : null}
        </Section>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="bp-panel">
      <p className="bp-muted">누르면 그 시점으로 돌아가요. 돌아간 상태에서 새로 고치면 그 뒤의 기록은 사라져요.</p>
      <ol className="bp-hist">
        {hist.entries.map((e, i) => ({ e, i })).reverse().map(({ e, i }) => (
          <li key={e.id}>
            <button className={`bp-hist-item ${i === hist.index ? "cur" : ""} ${i > hist.index ? "future" : ""}`} onClick={() => jumpTo(i)}>
              <span className="bp-hist-dot" />
              <span className="bp-hist-main"><b>{e.label}</b><span>{timeAgo(e.time)}</span></span>
              {i === hist.index ? <span className="bp-tag">지금</span> : null}
            </button>
          </li>
        ))}
      </ol>
      <Section title="수정 기록 데이터">
        <p className="bp-muted">직접 고친 것과 Claude에게 맡긴 것이 {editLog.length}건 쌓였어요. 내보내기의 “수정 기록”에 담겨서 취향 학습에 쓸 수 있어요.</p>
      </Section>
    </div>
  );

  const selEl = selId ? getEl(selId) : null;
  const panelBody = panel === "feedback" ? renderFeedback()
    : panel === "tweaks" ? renderTweaks()
    : panel === "inspect" ? renderInspect()
    : panel === "chat" ? <ChatPanel chat={chat} busy={busy} ctxLabel={!chatCtxOff && selEl ? labelOf(selEl) : null} onClearCtx={() => setChatCtxOff(true)} onSend={sendChat} />
    : renderHistory();

  const composer = pending ? (
    <Composer key={pending.ann.id} pending={pending} sheet={narrow} style={geo.comp || { left: -9999, top: 0 }} busy={!!busy}
      onDraft={(d) => { composerDraftRef.current = d; }}
      onSave={(d) => { saveFrom(pending, d); closePending(); }}
      onSaveApply={(d) => { const saved = saveFrom(pending, d); closePending(); applyAnnotations([saved]); }}
      onCancel={closePending}
      onDelete={() => removeAnn(pending.ann.id)}
      onResolve={() => toggleResolve(pending.ann)} />
  ) : null;

  const capture = !preview && (MARK_TOOLS.includes(tool) || tool === "hand");
  const selActions = {
    edit: () => selEl && beginEdit(selEl, { caretEnd: true }),
    comment: () => { if (selEl) { setTool("comment"); startComment(selEl); } },
    ask: () => askClaudeAbout(selId),
    duplicate: () => duplicateEl(selId),
    parent: () => selectParent(selId),
    remove: () => deleteEl(selId),
  };
  const DevIcon = DEVICES[device].Icon;
  const deviceIds = Object.keys(DEVICES);

  /* ── 화면 ── */
  return (
    <div className={`bp ${narrow ? "bp-narrow" : ""}`} ref={rootRef}>
      <style>{EDITOR_CSS}</style>

      <header className="bp-top">
        <div className="bp-brand"><span className="bp-mark"><Pencil size={15} strokeWidth={2.4} /></span>{!narrow ? "블루펜슬" : null}</div>
        {!narrow ? (
          <input className="bp-title" value={doc.title} aria-label="문서 제목"
            onChange={(e) => { const v = e.target.value; setHist((h) => ({ ...h, entries: h.entries.map((x, i) => (i === h.index ? { ...x, doc: { ...x.doc, title: v } } : x)) })); }} />
        ) : null}
        <div className="bp-spacer" />
        {narrow ? (
          <button className="bp-ib" onClick={() => changeDevice(deviceIds[(deviceIds.indexOf(device) + 1) % deviceIds.length])} title={`화면: ${DEVICES[device].label}`} aria-label={`화면 크기 바꾸기, 지금 ${DEVICES[device].label}`}><DevIcon size={17} /></button>
        ) : (
          <>
            <div className="bp-seg" role="group" aria-label="화면 크기">
              {deviceIds.map((id) => { const D = DEVICES[id]; return <button key={id} aria-pressed={device === id} onClick={() => changeDevice(id)} title={`${D.label} ${D.w}px`} aria-label={D.label}><D.Icon size={15} />{!compact ? D.label : null}</button>; })}
            </div>
            <div className="bp-zoom">
              <button className="bp-ib" onClick={() => zoomBy(1 / 1.2)} aria-label="축소"><ZoomOut size={16} /></button>
              <button className="bp-zoomval" onClick={() => setZoomMode("fit")} title="화면에 맞추기">{Math.round(zoom * 100)}%</button>
              <button className="bp-ib" onClick={() => zoomBy(1.2)} aria-label="확대"><ZoomIn size={16} /></button>
            </div>
          </>
        )}
        <div className="bp-spacer" />
        {busy ? <span className="bp-busy" role="status"><Loader2 size={13} className="bp-spin" />{!narrow ? busy.label : null}</span> : null}
        <button className="bp-ib" disabled={!canUndo} onClick={undo} title="되돌리기 (Ctrl/⌘+Z)" aria-label="되돌리기"><Undo2 size={17} /></button>
        <button className="bp-ib" disabled={!canRedo} onClick={redo} title="다시 실행 (Shift+Ctrl/⌘+Z)" aria-label="다시 실행"><Redo2 size={17} /></button>
        <button className="bp-ib" aria-pressed={preview} onClick={() => { endEdit(true); setPreview((p) => !p); setHover(null); }} title="미리보기" aria-label="미리보기"><Maximize2 size={16} /></button>
        {compact ? (
          <>
            <button className="bp-ib" onClick={() => setModal({ type: "import" })} title="불러오기" aria-label="불러오기"><Upload size={16} /></button>
            <button className="bp-ib" onClick={() => setModal({ type: "export", tab: "html" })} title="내보내기" aria-label="내보내기"><Download size={16} /></button>
          </>
        ) : (
          <>
            <button className="bp-btn" onClick={() => setModal({ type: "import" })}><Upload size={15} />불러오기</button>
            <button className="bp-btn" onClick={() => setModal({ type: "export", tab: "html" })}><Download size={15} />내보내기</button>
          </>
        )}
        <button className="bp-btn primary" disabled={!openAnns.length || !!busy} onClick={() => applyAnnotations(openAnns)} title="대기 중인 수정 요청을 Claude로 반영">
          <Sparkles size={15} />{!narrow ? "반영하기" : null}{openAnns.length ? <span className="bp-count">{openAnns.length}</span> : null}
        </button>
      </header>

      <div className="bp-main">
        <div className="bp-canvas-wrap">
          {busy ? <div className="bp-progress" /> : null}
          <div className="bp-canvas" ref={canvasRef} onPointerDown={(e) => { if ((e.target === e.currentTarget || e.target === stageRef.current) && tool === "select") setSelId(null); }}>
            <div className="bp-stage" ref={stageRef} style={{ padding: `${narrow ? 16 : 40}px ${padX}px ${narrow ? 150 : 110}px` }}>
              <div className="bp-sizer" style={{ width: devW * zoom, height: pageH * zoom }}>
                <div className="bp-page" ref={pageRef} style={{ width: devW, transform: `scale(${zoom})` }}>
                  <div className="bp-host" ref={hostRef} />
                  {capture ? (
                    <div className={`bp-capture ${tool === "hand" ? "hand" : ""}`} onPointerDown={onCapDown} onPointerMove={onCapMove} onPointerUp={onCapUp} onPointerCancel={onCapCancel} />
                  ) : null}
                  {!preview && (showMarks || pending) ? (
                    <MarkupLayer list={showMarks ? markList : markList.filter((a) => a._pending || (pending && a.id === pending.ann.id))} geoMap={geo.map} zoom={zoom} w={devW} h={pageH}
                      draft={draft} markColor={markColor} highlighter={highlighter}
                      hover={["select", "comment", "text"].includes(tool) ? hover : null}
                      sel={tool === "select" || tool === "text" ? geo.sel : null} editing={!!editingId && editingId === selId}
                      flashId={flashId} curId={pending ? pending.ann.id : null} activeIds={activeIds}
                      onPin={(a) => { if (!a._pending) openAnn(anns.find((x) => x.id === a.id) || a); }} selActions={selActions} />
                  ) : null}
                </div>
              </div>
              {pending && !narrow ? composer : null}
            </div>
          </div>

          {!narrow && !preview ? (
            <div className="bp-rail" role="toolbar" aria-label="도구">
              {TOOLS.map((t) => <button key={t.id} className="bp-tool" aria-pressed={tool === t.id} data-tip={`${t.label}  ${t.key}`} aria-label={t.label} onClick={() => setTool(t.id)}><t.Icon size={18} /></button>)}
              {MARK_TOOLS.includes(tool) ? (
                <>
                  <span className="bp-rail-sep" />
                  {MARK_COLORS.map((c) => <button key={c.id} className="bp-swatch" style={{ "--sw": c.value }} aria-pressed={markColor === c.value} aria-label={`${c.label} 표시`} onClick={() => setMarkColor(c.value)} />)}
                  {tool === "draw" ? <button className="bp-tool" aria-pressed={highlighter} data-tip="형광펜" aria-label="형광펜" onClick={() => setHighlighter((h) => !h)}><Highlighter size={17} /></button> : null}
                </>
              ) : null}
              <span className="bp-rail-sep" />
              <button className="bp-tool" aria-pressed={!showMarks} data-tip={showMarks ? "표시 숨기기" : "표시 보이기"} aria-label={showMarks ? "표시 숨기기" : "표시 보이기"} onClick={() => setShowMarks((s) => !s)}>{showMarks ? <Eye size={17} /> : <EyeOff size={17} />}</button>
            </div>
          ) : null}

          {narrow && !preview && !sheetOpen && !pending ? (
            <>
              {MARK_TOOLS.includes(tool) ? (
                <div className="bp-swatchbar">
                  {MARK_COLORS.map((c) => <button key={c.id} className="bp-swatch" style={{ "--sw": c.value }} aria-pressed={markColor === c.value} aria-label={`${c.label} 표시`} onClick={() => setMarkColor(c.value)} />)}
                  {tool === "draw" ? <button className="bp-ib sm" aria-pressed={highlighter} aria-label="형광펜" onClick={() => setHighlighter((h) => !h)}><Highlighter size={16} /></button> : null}
                </div>
              ) : null}
              <div className="bp-dock" role="toolbar" aria-label="도구">
                {TOOLS.filter((t) => t.id !== "hand").map((t) => <button key={t.id} className="bp-tool" aria-pressed={tool === t.id} aria-label={t.label} onClick={() => setTool(t.id)}><t.Icon size={18} /></button>)}
                <span className="bp-dock-sep" />
                <button className="bp-tool" aria-label="패널 열기" onClick={() => setSheetOpen(true)}><PanelBottom size={18} />{openAnns.length ? <span className="bp-dotcount">{openAnns.length}</span> : null}</button>
              </div>
            </>
          ) : null}

          {hintTool && !preview && !pending && TOOL_HINTS[hintTool] ? <div className="bp-hint" key={hintTool}>{TOOL_HINTS[hintTool]}</div> : null}
          {preview ? <div className="bp-previewbar">미리보기 중이에요<button onClick={() => setPreview(false)}>편집으로</button></div> : null}
        </div>

        {!narrow ? <aside className="bp-side" aria-label="패널">{tabs}{panelBody}</aside> : null}
      </div>

      {narrow && sheetOpen && !pending ? (
        <>
          <div className="bp-backdrop" onPointerDown={() => setSheetOpen(false)} />
          <div className="bp-sheet" role="dialog" aria-label="패널">
            <div className="bp-sheet-top"><span className="bp-grab" /><button className="bp-ib" onClick={() => setSheetOpen(false)} aria-label="패널 닫기"><X size={18} /></button></div>
            {tabs}
            {panelBody}
          </div>
        </>
      ) : null}
      {narrow && pending ? composer : null}

      {modal && modal.type === "export" ? <ExportModal initialTab={modal.tab} getHtml={getExportHtml} getHandoff={getHandoff} getJson={getJson} onClose={() => setModal(null)} notify={(m) => toast(m)} /> : null}
      {modal && modal.type === "import" ? <ImportModal hasWork={anns.length > 0 || hist.entries.length > 1} onImport={importHtml} onSample={() => { resetSession(parseHtml(SAMPLE_HTML), "AI 초안"); toast("예시 초안으로 새로 시작했어요"); }} onClose={() => setModal(null)} /> : null}

      <div className="bp-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="bp-toast">
            <span>{t.msg}</span>
            {t.action ? <button onClick={() => { t.onAction && t.onAction(); setToasts((l) => l.filter((x) => x.id !== t.id)); }}>{t.action}</button> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
