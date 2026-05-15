-- GitHub 연동 설정: Critical 취약점 발견 시 PR 머지 차단 여부
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS github_block_merge_on_critical BOOLEAN NOT NULL DEFAULT FALSE;
