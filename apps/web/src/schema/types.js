/**
 * 서비스 전체가 공유하는 데이터 구조 (source of truth)
 * 백엔드가 생겨도 이 모양은 그대로 유지하는 것이 원칙.
 */

/** 디자인 축 9개 (0~100). 리서치 B의 축 목록 기준 */
export const AXES = [
  "visual_complexity", // 시각적 복잡도
  "conventionality",   // 익숙함(높음) ↔ 새로움(낮음)
  "warmth",            // 차가움 ↔ 따뜻함
  "expressiveness",    // 절제 ↔ 표현
  "typography_drama",  // 타이포 대비·크기의 극적 정도
  "image_dominance",   // 이미지 비중
  "motion_intensity",  // 움직임 강도
  "playfulness",       // 진지함 ↔ 장난스러움
  "density",           // 정보 밀도
];

/**
 * 모든 신호는 세 종류로 분리해서 저장한다.
 * hard: 반드시 지킬 제약 / preference: 직접 표현한 선호 / hypothesis: AI 추론(확인 전)
 * @typedef {"hard"|"preference"|"hypothesis"} SignalKind
 * @typedef {"text"|"card"|"pairwise"|"edit"|"confirm"|"choice"} SignalSource   choice: 3안 중 고른 것
 *
 * @typedef {Object} Signal
 * @property {string} id
 * @property {SignalKind} kind
 * @property {SignalSource} source
 * @property {string} statement   사람이 읽을 수 있는 문장
 * @property {string=} axis
 * @property {number=} value      0~100
 * @property {number} confidence  0~1
 */

/**
 * @typedef {Object} AxisEstimate
 * @property {number} value       0~100, 초기값 50
 * @property {number} confidence  0~1, 초기값 0
 * @property {number} evidence    반영된 신호 수
 */

/**
 * Design DNA = USER 5층 모델 (Identity·Goal·Taste·Signature·Constraints)
 * @typedef {Object} DesignDNA
 * @property {{ selfDescription: string, traitsTarget: string[], traitsAvoid: string[], values: string[], contradictions: string[] }} identity
 * @property {{ primaryGoal: string, audience: string, conversionGoal: string, contentPriority: string[] }} goal
 *   contentPriority: 첫 화면 다음에 보여줄 섹션 순서 (예: ["projects", "about", "contact"])
 * @property {{ axes: Record<string, AxisEstimate>, selectedRefs: string[], rejectedRefs: string[], grammarMix: Record<string, number> }} taste
 * @property {{ objects: string[], sensoryMemories: string[], symbols: string[], quirks: string[] }} signature
 * @property {{ hard: Signal[], locale: string, reducedMotion: boolean }} constraints
 * @property {Signal[]} signals   모든 원본 신호 로그 (말한 것·고른 것·고친 것)
 */

/**
 * 디자인 토큰 — 생성 결과는 HTML이 아니라 이 구조로만 나온다.
 * @typedef {Object} DesignTokens
 * @property {{ bg: string, surface: string, text: string, muted: string, accent: string, onAccent: string }} color
 * @property {{ display: string, body: string, mono: string|null, scaleRatio: number, baseSize: number }} type
 * @property {{ unit: number, section: number }} space
 * @property {{ sm: number, lg: number }} radius
 * @property {{ duration: number, easing: string, level: "none"|"subtle"|"expressive" }} motion
 */

/**
 * @typedef {Object} Direction   Safe / Core / Stretch 3안
 * @property {"safe"|"core"|"stretch"} kind
 * @property {string} grammar      의도한 style grammar id (토큰의 출발점)
 * @property {string} template     실제로 그리는 템플릿 id — 그 grammar의 템플릿이 아직 없으면 구조가 가장 가까운 것
 * @property {DesignTokens} tokens
 * @property {string} rationale  왜 이렇게 만들었는지 한 문장
 * @property {string[]} notes      부가 안내 (대체 템플릿 사용, 지킨 hard 제약 등)
 * @property {string[]} signatures 시그니처 결정 1~3개
 * @property {"ai"|"mixed"|"rules"=} source  누가 만들었나 — ai: Claude, mixed: Claude 안 일부를 규칙으로 바꿈, 없음·rules: 규칙 엔진
 */

/**
 * @typedef {Object} Portfolio
 * @property {string} id
 * @property {string|null} slug      서브도메인 이름
 * @property {{ name: string, headline: string, bio: string, links: {label: string, url: string}[] }} person
 * @property {{ id: string, title: string, summary: string, role: string, year: string, tags: string[], cover: string|null, coverAlt: string }[]} projects
 *   cover: 이미지 주소. 목업에선 "img:<id>"(IndexedDB 참조) — 그릴 때 api.resolveImages로 바꿔서 쓴다
 *   coverAlt: 이미지 대체 텍스트. 빈 문자열이면 장식 이미지로 취급
 * @property {string[]} sections     노출 순서 (content_priority)
 * @property {string} grammar      고른 안의 grammar
 * @property {string} template     실제로 그리는 템플릿 (Direction.template)
 * @property {DesignTokens} tokens
 * @property {DesignTokens|null} originTokens  고른 안의 원래 토큰 — 편집 기록(edit 신호) 계산과 "되돌리기"용
 * @property {"draft"|"published"} status
 */

/**
 * 인터뷰 진행 상태. answers는 화면 입력 원본(뒤로 가서 고칠 때 복원용, source of truth),
 * dna는 answers를 빈 DNA에서부터 단계 순서대로 다시 반영한 결과(답이 바뀔 때마다 재계산).
 * @typedef {Object} InterviewSession
 * @property {1} version
 * @property {string} step         현재 단계 id
 * @property {DesignDNA} dna
 * @property {Record<string, any>} answers   단계 id → 입력값
 * @property {string} updatedAt
 */

export function createEmptySession() {
  /** @type {InterviewSession} */
  const session = { version: 1, step: "intent", dna: createEmptyDNA(), answers: {}, updatedAt: new Date().toISOString() };
  return session;
}

export function createEmptyDNA() {
  /** @type {DesignDNA} */
  const dna = {
    identity: { selfDescription: "", traitsTarget: [], traitsAvoid: [], values: [], contradictions: [] },
    goal: { primaryGoal: "", audience: "", conversionGoal: "", contentPriority: [] },
    taste: {
      axes: Object.fromEntries(AXES.map((a) => [a, { value: 50, confidence: 0, evidence: 0 }])),
      selectedRefs: [],
      rejectedRefs: [],
      grammarMix: {},
    },
    signature: { objects: [], sensoryMemories: [], symbols: [], quirks: [] },
    constraints: { hard: [], locale: "ko", reducedMotion: false },
    signals: [],
  };
  return dna;
}
