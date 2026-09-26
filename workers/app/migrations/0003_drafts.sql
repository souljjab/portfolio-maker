-- 다른 기기에서 이어 쓰기: 계정당 초안(포트폴리오)과 인터뷰 세션 한 벌.
-- version은 저장할 때마다 1씩 오른다. 저장 요청은 "마지막으로 본 버전"을 함께 보내고,
-- 서버 버전과 다르면(다른 기기가 먼저 저장) 거부해서 조용히 덮어쓰지 않는다.
CREATE TABLE drafts (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  portfolio_json TEXT,
  interview_json TEXT,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
