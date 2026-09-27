-- AI 추천·다듬기 끄기 (계정 설정, 기본 켜짐). 끄면 서버도 AI 호출을 거부한다.
ALTER TABLE users ADD COLUMN ai_opt_out INTEGER NOT NULL DEFAULT 0;
