-- 발행된 사이트 (계정당 하나). 주소(slug)를 먼저 여기서 차지한 뒤 R2에 쓴다 → 동시에 같은 주소를 노려도 한 명만.
CREATE TABLE sites (
  slug TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  published_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 발행용으로 올린 이미지 (R2 uploads/{user_id}/{key}). key = 내용 SHA-256 + 확장자 → 같은 이미지는 한 번만 저장
CREATE TABLE uploads (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);
