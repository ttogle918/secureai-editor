-- ShedLock 테이블 — Redis Provider 사용 시 실제 락은 Redis에 저장되지만
-- 폴백·모니터링 용도로 DB 테이블도 생성한다.
CREATE TABLE IF NOT EXISTS shedlock (
    name       VARCHAR(64)  NOT NULL,
    lock_until TIMESTAMPTZ  NOT NULL,
    locked_at  TIMESTAMPTZ  NOT NULL,
    locked_by  VARCHAR(255) NOT NULL,
    CONSTRAINT pk_shedlock PRIMARY KEY (name)
);
