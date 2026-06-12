-- TASK-1211: PR 웹훅 → AI 취약점 분석 디스패치
-- PrReviewHistory에 AI 분석 sessionId와 GitHub App installationId 컬럼 추가.
-- session_id: 분석 완료 콜백(Redis) → PrReviewHistory 역조회 키
-- installation_id: 분석 완료 시 설치 토큰 재발급용 (원 토큰 ~1시간 만료 대비)
ALTER TABLE pr_review_history
    ADD COLUMN session_id      UUID   NULL,
    ADD COLUMN installation_id BIGINT NULL;
