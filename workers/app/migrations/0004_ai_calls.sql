-- Claude 호출 기록: 사용량 제한(사용자별·전체)과 비용 확인용. 사용자가 쓴 글·모델 출력은 저장하지 않는다.
CREATE TABLE ai_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,              -- directions
  created_at INTEGER NOT NULL,
  -- pending / ok / partial(일부 안을 규칙으로 바꿈) / refused / invalid / error / timeout
  outcome TEXT NOT NULL DEFAULT 'pending',
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_read_tokens INTEGER,
  cache_write_tokens INTEGER,
  issues TEXT,                     -- 규칙으로 바꾼 곳 (JSON 배열, 사용자 글 없음)
  ms INTEGER
);
CREATE INDEX ai_calls_user ON ai_calls (user_id, created_at);
CREATE INDEX ai_calls_time ON ai_calls (created_at);
