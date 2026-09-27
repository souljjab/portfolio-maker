-- 초안 버전 기록 (편집기 "버전 기록"). 계정당 최근 30개만 남긴다. 이미지는 upload:<key> 참조만(파일은 uploads에).
CREATE TABLE draft_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  label TEXT NOT NULL,
  portfolio_json TEXT NOT NULL
);
CREATE INDEX draft_versions_user ON draft_versions (user_id, created_at);
