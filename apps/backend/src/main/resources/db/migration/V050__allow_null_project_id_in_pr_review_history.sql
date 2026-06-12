-- TASK-1201: GitHub Webhook 수신 시 projects 테이블에 매핑이 없는 경우에도
-- pr_review_history 이력은 보존해야 한다. project_id를 nullable로 변경한다.
-- 기존 NOT NULL 제약 제거 — 값이 있는 행은 영향 없음.
ALTER TABLE pr_review_history
    ALTER COLUMN project_id DROP NOT NULL;
