-- 계정 삭제(7일 유예)와 보호자 동의 철회
ALTER TABLE users ADD COLUMN deletion_requested_at INTEGER;   -- 삭제 요청 시각 (7일 뒤 매일 도는 정리 작업이 지운다)
ALTER TABLE users ADD COLUMN guardian_withdraw_hash TEXT;     -- 보호자 동의 철회 링크 토큰의 해시 (동의할 때 만들고 메일로 보냄)
ALTER TABLE users ADD COLUMN guardian_withdrawn_at INTEGER;   -- 보호자가 동의를 철회한 시각
CREATE INDEX idx_users_deletion ON users (deletion_requested_at);
