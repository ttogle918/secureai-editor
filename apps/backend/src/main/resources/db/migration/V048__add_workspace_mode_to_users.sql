-- V048: users 테이블에 workspace_mode 컬럼 추가
-- TASK-1101 — Persona 온보딩 + 백엔드 연동

ALTER TABLE users
    ADD COLUMN workspace_mode TEXT NOT NULL DEFAULT 'DEVELOPER';

ALTER TABLE users
    ADD CONSTRAINT chk_workspace_mode
        CHECK (workspace_mode IN ('DEVELOPER', 'SECURITY_MANAGER', 'BOTH'));
