-- Stage B: content_hash 동시성 안전망 — 크롤러 중복 적재 방지 unique 인덱스
--
-- 설계 근거:
--   Stage A 시드 데이터는 content_hash = NULL 이다.
--   PostgreSQL 에서 NULL 은 서로 distinct 하므로 일반 UNIQUE 인덱스도 NULL 행 위반을 일으키지 않는다.
--   그러나 인덱스 목적("크롤러가 채운 값만 unique 보장")을 명확히 표현하기 위해
--   WHERE content_hash IS NOT NULL 조건부(partial) unique 인덱스를 선택한다.
--   이 방식은:
--     1) NULL 행을 인덱스 범위 밖으로 명시적으로 제외해 의도를 코드로 표현
--     2) NULL 행 수가 늘어도 인덱스 크기가 불필요하게 증가하지 않음
--     3) 향후 content_hash NOT NULL 컬럼 제약을 추가할 때 마이그레이션 단계 명확
--
-- 두 크롤러 인스턴스가 동시에 동일 hash 를 INSERT 하면 unique 위반 → 한쪽 롤백, 중복 적재 방지.
CREATE UNIQUE INDEX idx_cfi_content_hash
    ON compliance_feed_items (content_hash)
    WHERE content_hash IS NOT NULL;
