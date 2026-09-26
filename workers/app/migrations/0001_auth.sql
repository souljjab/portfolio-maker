-- 계정·로그인 코드·세션·보호자 동의. 시각은 모두 epoch 밀리초.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  -- unknown: 아직 안 물어봄 / ok: 만 14세 이상 / pending_guardian: 보호자 동의 대기 / guardian_ok: 보호자 동의 완료
  age_status TEXT NOT NULL DEFAULT 'unknown',
  guardian_email TEXT,
  guardian_requested_at INTEGER,
  guardian_consented_at INTEGER
);

-- 6자리 코드는 원문을 저장하지 않고 HMAC(pepper, email:code)만 저장
CREATE TABLE login_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_login_codes_email ON login_codes (email, created_at);
CREATE INDEX idx_login_codes_ip ON login_codes (ip, created_at);

-- 세션 토큰은 쿠키에만 있고, DB에는 SHA-256 해시만
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE guardian_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
