-- V060: triage_feedback 테이블 생성
-- MOAT-1: 트리아지 피드백(확인/기각/채택) 이력 — append-only 라벨 학습 자산
-- UPDATE/DELETE 금지 (레코드 불변성은 애플리케이션 레이어에서 강제)

CREATE TABLE triage_feedback (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    vulnerability_id UUID        NOT NULL,
    user_id         UUID        NOT NULL,
    action          VARCHAR(20) NOT NULL,   -- CONFIRM | DISMISS | ACCEPT_PATCH
    reason          TEXT,                   -- 선택적 사유 (민감정보 가능 — 로그 출력 금지)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT pk_triage_feedback PRIMARY KEY (id),
    CONSTRAINT fk_triage_feedback_vuln
        FOREIGN KEY (vulnerability_id)
        REFERENCES vulnerabilities(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_triage_feedback_action
        CHECK (action IN ('CONFIRM', 'DISMISS', 'ACCEPT_PATCH'))
);

CREATE INDEX idx_triage_feedback_vuln    ON triage_feedback (vulnerability_id);
CREATE INDEX idx_triage_feedback_user    ON triage_feedback (user_id);
CREATE INDEX idx_triage_feedback_created ON triage_feedback (created_at);
