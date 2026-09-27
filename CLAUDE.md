# 포트폴리오 메이커

디자인을 말로 잘 설명하지 못하는 사람도 대화·시각 카드 비교·선호 학습으로 자기 취향(Design DNA)을 찾고, 그것을 포트폴리오 사이트로 만들어 `사용자명.도메인` 서브도메인으로 공개·공유하는 서비스.
핵심 가설은 "코드를 잘 생성하는가"가 아니라 "취향을 잘 알아내는가"이다.

## 저장소 구조
- `apps/web` — 프론트엔드 (React + Vite, JavaScript + JSDoc 타입)
- `workers/app` — `app.도메인` Worker: 앱 정적 파일 + `/api` (로그인·계정·발행, D1 + R2)
- `workers/router` — `*.도메인` 사용자 사이트 서빙 Worker (R2 `sites/{주소}/`)
- `docs/decisions.md` — 확정된 결정과 그 이유
- `docs/research-notes.md` — 설계 근거가 된 리서치 요약

## 명령어
- 프론트엔드: `cd apps/web && npm install && npm run dev` / 빌드 `npm run build` / 린트 `npm run lint`
- 라우터: `cd workers/router && npm install && npm run dev` (:8788, 발행한 사이트를 `http://주소.localhost:8788`로 열기) / 배포 `npm run deploy` (배포 전 `YOUR_DOMAIN` 교체)
- API(로컬): `cd workers/app && npm install && cp .dev.vars.example .dev.vars && npm run db:migrate:local && npm run dev` (:8787). 프론트 개발 서버가 `/api`를 여기로 넘긴다. 메일은 보내지 않고 터미널에 출력, 코드·동의 링크는 화면의 "개발 모드" 칸에도 표시. `npm run dev`가 서버용 렌더러(`build:render`)를 먼저 만든다
- 두 Worker는 로컬 저장소 `.wrangler/state`(저장소 루트)를 함께 쓴다(`--persist-to`). 검증: API·라우터를 띄운 상태에서 `workers/app`의 `npm run test:auth`, `npm run test:publish`, `npm run test:sync`, `npm run test:ai`
- API 배포 전: `YOUR_DOMAIN`·D1 id 교체, `wrangler secret put CODE_PEPPER`·`RESEND_API_KEY`, `npm run db:migrate:remote`, 먼저 `apps/web` 빌드
- 개발 서버 첫 화면의 "템플릿 비교" 탭: 템플릿 × 토큰 조합을 패널 3개로 나란히 보고 대비 검사 결과 확인
- 두 페이지: `index.html` = 앱(배포 시 `app.도메인`), `landing.html` = 서비스 랜딩(루트 도메인, 개발 중엔 `/landing.html`). 랜딩의 "시작하기" 주소는 `apps/web/.env`의 `VITE_APP_URL`(배포 때 `https://app.도메인`)

## 현재 단계
프론트엔드 우선 개발 중. 백엔드는 나중에 붙인다.
완료: 데이터 스키마, style grammar 10종 수치, 규칙 기반 취향 엔진, WCAG 대비 게이트, 목업 API 계층, 엔진 디버그 화면, 라우팅 PoC 코드(미배포).
완료: grammar 템플릿 3종(quiet-editorial, bold-type, technical) + 템플릿 비교 화면. 12개 템플릿×토큰 조합 axe 검사 통과, 키보드 focus·reduced-motion 확인.
완료: 인터뷰 8단계(`src/screens/interview/`) — 자유 입력 → 목적 → 인상 → 모호한 단어 풀기 → 콘텐츠 순서 → 시각 카드(썸네일 10종) → A/B → 방향 확인.
완료: 3안 — 엔진(`src/engine/directions.js`: hard 제약 → grammar 배정 → 토큰 조정 → 대비 자동 보정), 비교·선택 화면(`src/screens/directions/`, iframe 정적 미리보기), 이름·한 줄 입력, 좋았던 점, 섞기(색·글꼴 묶음), 고른 안을 초안으로 저장. 템플릿 6종(+warm-minimal, organic, gallery).
완료: 편집기 범위 A(콘텐츠만, `src/screens/editor/`) — 이름·한 줄 소개·소개글·작업(추가·순서·삭제/되돌리기·태그)·링크(이메일→mailto 자동 변환), 자동 저장, 실시간 미리보기. 검증은 `src/engine/content.js`(발행 전 검사에도 재사용).
완료: 이미지 업로드(브라우저에서 긴 변 1600px WebP로 줄여 IndexedDB 저장, 초안엔 "img:<id>" 참조만), 이미지 설명(alt).
완료: 가짜 publish(`src/screens/publish/`) — 발행 전 점검(오류는 막고 "고치러 가기"로 해당 칸 이동, 주의사항은 안내만), 슬러그 검사, 연습 발행, HTML(이미지 내장 단일 파일)·JSON 내려받기.
완료: 디자인 다듬기(편집기) — 강조색·배경 톤·글꼴·글자 크기 차이·여백·모서리·움직임, 모든 변경은 대비 게이트 재통과. 고른 안 대비 바뀐 곳을 edit 신호로 DNA에 반영.
완료: 루트 랜딩(`landing.html` + `src/landing/`) — 본문은 정적 HTML(스크립트 없이도 읽힘), 첫 화면 그림만 카드 썸네일로 덧붙임.
완료: 로그인(이메일 6자리 코드) — `workers/app`. 세션 D1, `__Host-session` 쿠키, Origin+CSRF, 나이 확인·보호자 동의(동의 페이지는 버튼을 눌러야 동의). 발행 화면에 계정 단계.
완료: 실제 발행 — 이미지 업로드(파일 앞 바이트로 형식 확인, 내용 해시 이름) → 서버가 앱과 같은 템플릿으로 렌더링 → R2 `sites/{주소}/` → 라우터가 서빙. 계정당 사이트 하나(다른 주소로 발행하면 옮김), 비공개 전환. 사이트 CSP `script-src 'none'`, HTML `no-cache`+ETag 304.
완료: 초안·인터뷰 동기화(다른 기기) — 로그인 + 나이 확인 끝난 계정만, D1 `drafts` 버전으로 충돌 방지, 충돌 시 사용자가 선택. 이미지는 서버 키(`upload:<sha256>`)로, 다른 기기에선 받아서 캐시.
완료: Claude 3안(`workers/app/src/ai.js` + `src/engine/aiDirections.js`) — 로그인·나이 확인한 계정만, 출력은 규칙 엔진이 안별로 재검사, 실패하면 규칙 결과. 키(`ANTHROPIC_API_KEY`)가 없으면 규칙 엔진만.
완료: 가입·로그인 후 시작 — 앱 첫 화면이 "무료로 시작하기"(`src/screens/start/`). 로그아웃하면 이 기기 작업을 지운다.
완료: Claude 3안 평가 세트(`workers/app/eval/directions/`, 페르소나 24명) — 무료 파일럿(규칙 엔진)까지. 유료 실행(v1 low·v2 medium)은 API 키·하네스 승인 뒤.
완료: 블루펜슬 편집기 옮기기 1단계 — 개성 포인트 6종(`src/templates/addons.js`), 분위기 프리셋 4종(`src/data/moodPresets.js`), 글꼴 12종(`fonts.js`). 편집기 "디자인 다듬기"에서 켜고, 발행 사이트에도 같게 나온다.
완료: 블루펜슬 2단계 — 편집 캔버스(`src/screens/editor/EditCanvas.jsx`): 데스크톱·태블릿·모바일, 미리보기에서 이름·한 줄 소개·소개글·작업 제목·설명을 그 자리에서 고치기, 작업·링크를 누르면 입력 칸으로.
다음: 블루펜슬 3단계(표시하기·대화로 고치기, Claude는 내용·토큰·개성 포인트 변경만) → 3안 평가 유료 실행 → 모델·effort 확정 → 인터뷰 자유 입력 해석 → 남은 grammar 템플릿.
공개 전 필수: 개인정보처리방침에 Claude(Anthropic) 전송 항목 명시, 보호자 동의 철회 기능(동의 페이지에 "언제든 철회" 안내가 있음), Resend 계정·도메인 SPF/DKIM, Turnstile 화면 위젯(서버 검증 자리는 있음), 이용약관·개인정보처리방침, 계정 삭제.
남은 grammar 4종(swiss·bento·retro-web·experimental)은 가까운 템플릿으로 대체 렌더링 중(근거 문장에 명시). 자주 선택되면 같은 구조로 추가(썸네일 `src/thumbnails/`가 설계 스케치).
미정: 축 확신도가 신호 개수만 반영(서로 어긋난 신호도 확신도↑). 지금은 A/B·확인 문장이 "확신도×치우침"으로 우회 중 — `AxisEstimate`에 분산을 넣을지 결정 필요.

## 인터뷰 구조 (`src/screens/interview/`)
- 세션은 `{ step, answers, dna }`. `answers`(화면 입력 원본)가 source of truth이고, `dna`는 답이 바뀔 때마다 `replayAnswers`로 빈 DNA에서 다시 계산한다(카드·A/B·편집이 축을 누적시키므로 부분 수정 불가).
- 단계 추가: 화면은 `Interview.jsx`의 `STEPS`에 `{ id, n, title, question, hint, Component, summarize }`, DNA 반영은 `engine/replay.js`의 `APPLY_ORDER`에. 각 단계는 `baseDna`(직전까지의 DNA)를 받는다.
- 선택지는 `ChipPicker`(네이티브 checkbox/radio)로 만든다. 단계가 바뀌면 질문 h1로 focus 이동, 동적 변화는 `.iv-sr` aria-live로 알린다.

## 템플릿 구조 (`src/templates/`)
- 템플릿은 `({ portfolio, tokens })`만 받는 상태 없는 컴포넌트. 훅·이벤트 핸들러 없이 props → 마크업만 만든다(정적 HTML export를 위해). 새 템플릿은 `index.js` 레지스트리에 등록.
- 토큰은 반드시 `tokensToCssVars`를 거쳐 CSS 변수로 들어간다. 색은 hex, 폰트는 `fonts.js` 허용 목록, 이징은 정해진 형식만 통과(AI 값이 CSS 선언을 끼워 넣지 못하게).
- 링크·이미지 URL은 `utils.js`의 `safeUrl`로 거른다. `<style>`에는 개발자가 쓴 정적 CSS만 넣는다.
- grammar CSS는 `.pf-{grammar}` 아래로 중첩하고, 반응형은 미디어 쿼리 대신 컨테이너 쿼리(`@container`, `cqi`)를 쓴다.
- 강조색 글자는 큰 글자(24px 이상)에만. 작은 글자는 text·muted만 쓴다(대비 게이트가 accent/bg는 3:1만 보장).
- grammar별 기본 토큰 10세트는 `src/data/grammarTokens.js`(모두 대비 게이트 통과해야 함). 시그니처 문구는 `src/data/signatures.js`(템플릿 기준).
- 정적 HTML 문서는 `renderHtml.js`의 `renderPortfolioHtml` 하나로 만든다(미리보기 iframe srcdoc = 발행 결과). 무거워서 화면에서는 동적 import.
- 미리보기 문서에는 `<base target="_blank">`가 들어가므로 템플릿에 페이지 안 앵커(`#…`) 링크를 넣지 않는다.
- 모든 템플릿은 공통 훅 클래스를 단다: `pf-hero-title`(첫 화면 제목), `pf-headline`(한 줄 소개), `pf-card`(작업 하나), `pf-links`(링크 목록). 개성 포인트 CSS가 이것만 겨냥한다 — 새 템플릿도 꼭 달 것.
- 개성 포인트는 토큰의 `addons`(id 목록). CSS는 `addons.js`의 허용 목록만, 모르는 id는 무시. `addonProblem`이 대비(형광펜 띠 위 3:1)·움직임 없음(기우는 카드)을 막고, 렌더러는 문제 있는 건 조용히 뺀다. 켜고 끈 것은 edit 신호 + DNA 시그니처 층(`signature.quirks`)에 남는다(축은 edit 가중치의 1/3로만).

## 3안 구조 (`src/engine/directions.js`, `src/screens/directions/`)
- `buildDirections(dna, availableTemplates)` — 엔진은 JSX를 import하지 않고 구현된 템플릿 목록을 인자로 받는다(api가 레지스트리에서 넘김). node로 검증 가능.
- Direction은 `grammar`(의도)와 `template`(실제 렌더링)를 구분. 템플릿 없는 grammar는 구조가 가장 가까운 템플릿 + 원래 grammar 토큰.
- 세 안이 다른 템플릿이 되도록 하되, 거리 차이 6 이내일 때만(취향 충실도 우선).
- 3안 고르기도 인터뷰 단계(`directions`)라 선택·섞기가 DNA 신호로 남는다.

## 편집기 구조 (`src/screens/editor/`)
- 편집 캔버스는 발행과 같은 HTML(`renderPortfolioHtml({ editable: true })`)을 iframe에 그린다. 샌드박스는 스크립트 불가 그대로, `allow-same-origin`만 줘서 부모가 클릭·호버를 받는다. 템플릿의 칸 표시 `data-pf-field`(이름·순서만)는 editable일 때만 남고 발행·내려받기·3안 미리보기에선 지워진다.
- 칸 이름: `name`·`headline`·`bio`·`project.{i}`·`project.{i}.title|summary`·`links.{i}`. 새 템플릿도 같은 칸 표시를 달 것. 키보드·스크린리더는 왼쪽 입력 칸으로 모두 고칠 수 있다(캔버스는 보조 수단).
- 초안은 불완전해도 자동 저장(0.6초), 오류는 칸을 벗어난 뒤에만 표시하고 막지 않는다. 발행은 `validatePortfolio`가 빈 객체일 때만 허용할 예정.
- 내용이 없는 섹션(소개글·작업·링크)은 템플릿이 `visibleSections`로 건너뛴다. 링크 key는 순서 기반(주소가 비거나 겹칠 수 있음).
- 순서 이동은 위·아래 버튼(끝은 aria-disabled), 삭제는 확인창 대신 되돌리기 알림.

## 이미지·발행·편집 신호
- 초안의 `cover`는 목업에서 `img:<id>` 참조. 그릴 때만 `api.resolveImages`(화면에선 `useResolvedPortfolio`)로 data URL 사본을 만든다 — 사본은 절대 저장하지 않는다(localStorage 한도).
- 템플릿 이미지 주소는 `safeImageSrc`: https 또는 base64 png·jpeg·webp·gif data URL만. 안 쓰는 이미지는 `loadDraft` 때 정리(되돌리기를 위해 즉시 지우지 않음).
- `api.publish`는 슬러그·내용을 다시 검사한다(서버는 화면 검사를 믿지 않음). 서버는 토큰 JSON으로 직접 렌더링하고 클라이언트 HTML은 받지 않는다.
- 답 → DNA 반영 순서는 `src/engine/replay.js`(`replayAnswers`). 편집기의 디자인 편집은 `answers.edits`로 인터뷰 세션에 기록되고 가장 큰 가중치(edit 1.5)로 반영된다. 3안을 다시 고르면 `answers.edits`는 지운다(원래 토큰이 바뀌므로).
- 초안의 `originTokens`는 고른 안의 원래 토큰(편집 차이 계산·되돌리기 기준).

## 발행 구조 (`workers/app/src/publish.js`, `workers/router`)
- 서버는 클라이언트 HTML을 받지 않는다. `apps/web/src/server/entry.js`를 `npm run build:render`로 묶은 `workers/app/src/generated/render.js`(생성물, gitignore)로 앱과 같은 템플릿·검증 코드를 쓴다. 템플릿을 고치면 이 번들을 다시 만들어야 서버에 반영된다.
- 받은 내용은 `normalizeForPublish`(알려진 필드만, 길이·개수 제한) → `validatePortfolio` → 템플릿·토큰 모양 확인 순으로 다시 검사.
- 주소는 D1 `sites`에서 먼저 차지(PK·UNIQUE)한 뒤 R2에 쓴다 → 동시 요청 경쟁 방지. 이미지는 `uploads` 기록이 있는 내 이미지만.
- 사이트 이미지는 `/img/<sha256>.<ext>`만 허용(`safeImageSrc`), 외부 이미지는 싣지 않는다(CSP `img-src 'self' data:` — data:는 개성 포인트의 그레인·커서 무늬용).
- 로컬 라우터는 `env.dev`(라우트 없음)로 띄운다 — 라우트가 있으면 wrangler dev가 요청 호스트를 라우트 도메인으로 바꿔 주소를 알 수 없음.

## 동기화 구조 (`apps/web/src/api/index.js` 아래쪽, `workers/app/src/drafts.js`)
- 상태 줄의 "계정" 버튼에서 로그아웃·보호자 동의 확인.
- 만 14세 미만은 보호자 동의 전엔 동기화하지 않는다(개인정보를 서버에 두지 않음).
- 기기마다 `pf:sync` = { email, version, dirtySeq, pushedSeq, uploaded }. 저장 → 변경 표시 → 2초 뒤 올리기. 서버 내용을 가져오는 건 앱을 열 때·로그인 직후·충돌에서 고를 때만. 가져오면 `onRemoteApplied`로 열린 화면을 다시 불러온다.
- 올릴 때 이 기기 초안은 건드리지 않고 "보내는 사본"에만 `img:` → `upload:`를 적용한다(편집기 상태와 어긋나면 이미지 정리가 로컬 파일을 지울 수 있음). 이미 올린 이미지는 `uploaded` 기록으로 재업로드하지 않는다.
- 초안의 cover 참조: `img:<id>`(이 기기), `upload:<key>`(서버, 다른 기기에선 `srv-<key>`로 캐시), 발행 사이트에선 `/img/<key>`.

## Claude 구조 (`src/engine/aiDirections.js`, `workers/app/src/ai.js`)
- 프롬프트·출력 스키마·입력 정리(`normalizeDna`·`summarizeDna`)·출력 검증(`acceptAiDirections`)은 순수 함수 한 곳에. 서버는 render 번들로, 앱과 평가는 소스로 같은 코드를 쓴다 — 프롬프트를 고치면 `build:render` 다시.
- 시스템 프롬프트는 요청마다 같은 바이트(prompt caching). 날짜·사용자 정보를 넣지 말 것. 출력 스키마(`OUTPUT_SCHEMA`)도 고정 — 바꾸면 캐시가 깨진다.
- 앱의 `generateDirections`는 동기화 상태가 로그인+나이 확인일 때만 서버를 부르고, 받은 결과도 `acceptAiDirections`로 한 번 더 검사한다.
- `Direction.source`: ai / mixed(일부를 규칙으로) / 없음(규칙). 호출 기록은 D1 `ai_calls`(토큰 수·결과·바꾼 곳만, 사용자 글 없음).
- 검증: `npm run test:ai`(37개 — 가짜 Anthropic 서버로 실제 호출 0, 별도 wrangler dev :8797을 띄웠다 끔).

## 3안 평가 (`workers/app/eval/directions/`)
- 페르소나 24명(`cases.json`: 명확·모순·말 적음·모호한 말·hard 제약·인젝션). 각자 인터뷰 답 + 인터뷰에 다 드러나지 않는 "진짜 취향"(truth·persona). A/B·확인 질문 답은 truth로 시뮬레이션(`lib.mjs`의 `interviewFor`).
- variant: baseline = 규칙 엔진(무료), v1 = Claude effort low, v2 = medium. 결과는 저장소 루트 `.claude/hillclimb/directions/<variant>/`(results.jsonl·traces·previews/ 실제 템플릿 미리보기).
- 채점: 무료 자동(추천안 적합도·금지 지킴·안전·Claude 채택·화면 다양성) + Sonnet 5가 규칙 엔진 3안(고정 ref)과 가린 채 쌍 비교(win).
- Claude는 본문 글꼴 2종·고정폭 1종만 고를 수 있다(`aiDirections.js`의 BODY_FONTS·MONO_FONTS). 제목 글꼴은 fonts.js 전체.
- 실행(workers/app): `node eval/directions/pilot.mjs`(무료 입력 검토 페이지) / `npm run eval:directions -- --variant baseline|v1|v2` / `npm run eval:report`. 하네스(러너·케이스·프롬프트)를 고치면 사람이 `--approve-harness`로 다시 승인해야 돈다.

## 로그인 구조 (`workers/app/src/auth.js`, `src/screens/start/`)
- 앱은 로그인한 사람만 쓴다. `App.jsx`가 `onAccountChange`로 상태를 받아 로그인 전·나이 확인 전이면 첫 화면(`StartGate`)을 보여 준다. 가입과 로그인은 같은 흐름(코드 확인 시 없으면 만듦).
- 만 14세 미만은 보호자 동의 전에도 "먼저 만들어 보기"로 들어올 수 있다 — 작업은 이 기기에만, 동기화·Claude·발행은 동의 뒤.
- 로그아웃은 이 기기의 초안·인터뷰·이미지를 지운다(같은 기기의 다른 계정이 넘겨받지 않게). 서버에 다 안 올라간 작업이 있으면 먼저 확인받는다. 로그아웃 뒤엔 `writesLocked`로 닫히는 화면의 자동 저장도 막는다.
- 이 기기에 다른 계정의 작업(`pf:sync.email`이 다름)이 남아 있으면 올리지 않고 비운 뒤 서버 내용을 받는다. 계정 없이 만든 예전 작업(email null)만 로그인한 계정으로 이어 올린다.
- 코드는 HMAC(pepper, email:code)만 저장, 10분·5번 시도·새 코드 받으면 이전 코드 무효, 이메일당 시간당 5번·IP당 20번. 코드 요청 응답은 가입 여부와 무관하게 같다.
- 상태를 바꾸는 요청은 `Origin === APP_ORIGIN` + (세션이 있으면) `X-CSRF-Token`. 프론트는 `api/index.js`의 `apiFetch`가 CSRF 헤더를 붙인다.
- `EXPOSE_DEV_CODE=1`(응답에 코드·동의 링크 포함)은 `.dev.vars`에만. 배포 설정에 넣지 말 것.
- 서버 검증: `npm run test:auth`(30개 — Origin·CSRF·코드 시도·요청 제한·보호자 동의·쿠키 속성), `npm run test:publish`(29개 — 이미지 형식·주소 소유·서버 재검사·CSP·304·주소 이동·비공개), `npm run test:sync`(16개 — 버전 충돌·다른 기기·이미지 소유·보호자 동의 전 차단).
- 로컬은 모든 요청이 한 IP라 `.dev.vars`의 `LOGIN_IP_LIMIT=1000`으로 코드 요청 IP 제한을 풀어 둔다(배포 기본 20).

## 반드시 지킬 아키텍처 규칙
- 화면 코드는 `src/api/index.js`의 함수만 호출한다. 목업 → 실제 fetch 교체는 이 파일 안에서만 한다. 반환 모양은 바꾸지 않는다.
- 데이터 구조의 기준은 `src/schema/types.js`. 새 필드가 필요하면 여기부터 고친다.
- AI 생성 결과는 HTML이 아니라 디자인 토큰 JSON이다. 템플릿(grammar) + 토큰 + 이스케이프된 텍스트로만 렌더링한다. 사용자 사이트에서 사용자 작성 스크립트는 절대 실행되지 않아야 한다(보안 규칙이기도 함).
- 모든 신호는 hard / preference / hypothesis로 분리 저장한다. 가설을 요구사항처럼 다루지 않는다.
- 접근성은 취향이 아니라 탈락 기준: 텍스트 대비 4.5:1, 큰 글자 3:1, 터치 타깃 24px 이상, prefers-reduced-motion 존중, 키보드 focus, semantic HTML.
- 엔진 함수는 순수 함수로 유지하고 DNA를 직접 변경하지 않는다.

## 작업 방식
- 설명과 커밋 메시지, 주석은 한국어로. 설명은 간결한 줄글 선호.
- 설계 결정이 필요한 지점에서는 먼저 선택지를 설명하고 확인을 받은 뒤 진행한다.
- 작업 단위를 작게 유지하고, 끝나면 무엇을 바꿨는지와 다음 결정사항을 짧게 정리한다.
