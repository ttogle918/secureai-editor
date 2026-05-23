-- monitoring_results 파티션 마스터 테이블
-- PARTITION BY RANGE (checked_at) — 월별 파티션 자동 생성 (MonitoringPartitionJob)
CREATE TABLE monitoring_results (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    scan_target_id      UUID            NOT NULL,
    project_id          UUID            NOT NULL,
    status              VARCHAR(20)     NOT NULL,   -- UP / DOWN / SSL_EXPIRING / SSL_EXPIRED
    http_status_code    INT,
    response_time_ms    BIGINT,
    ssl_expires_at      TIMESTAMPTZ,
    ssl_days_remaining  INT,
    error_message       TEXT,
    checked_at          TIMESTAMPTZ     NOT NULL
) PARTITION BY RANGE (checked_at);

-- 첫 달 파티션: 2026-05
CREATE TABLE monitoring_results_2026_05
    PARTITION OF monitoring_results
    FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');

-- 다음 달 파티션: 2026-06
CREATE TABLE monitoring_results_2026_06
    PARTITION OF monitoring_results
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

-- 복합 인덱스: scan_target_id + checked_at (파티션별 자동 생성됨)
CREATE INDEX idx_monitoring_results_target_checked
    ON monitoring_results (scan_target_id, checked_at);
