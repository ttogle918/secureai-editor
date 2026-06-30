-- 컴플라이언스 피드 아이템 테이블
-- Stage A: 기존 mock 데이터(page.tsx / compliance-feed.json) 적재
-- Stage B: 크롤러·RAG 연동 예정 — content, content_hash 컬럼 활용

CREATE TABLE compliance_feed_items (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    section         VARCHAR(30)  NOT NULL
                    CHECK (section IN ('GOV_RECOMMENDATION','SECURITY_NEWS','AGENCY_POST')),
    agency          VARCHAR(100),
    category        VARCHAR(150),
    source          VARCHAR(100),
    title           VARCHAR(500) NOT NULL,
    summary         TEXT,
    content         TEXT,           -- 크롤러 원문 (Stage A: NULL, Stage B: RAG 임베딩 원천)
    source_url      VARCHAR(1000),
    published_date  DATE,
    files           JSONB        NOT NULL DEFAULT '[]',  -- 첨부 메타 [{name,type,size}]
    content_hash    VARCHAR(64),    -- 크롤러 중복 적재 방지 (Stage A: NULL)
    sort_order      INT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_cfi_section_date ON compliance_feed_items (section, published_date DESC);
CREATE INDEX idx_cfi_source_url   ON compliance_feed_items (source_url);

-- ── 시드 데이터 (Stage A) ─────────────────────────────────────────────────────

-- 정부 권장 사항 — 기존 page.tsx GOV_RECOMMENDATIONS 배열 값 그대로 적재
-- (published_date: 월 단위 표기 "2026-06" → 해당 월 1일로 저장)
INSERT INTO compliance_feed_items
    (section, agency, category, source, title, summary, source_url, published_date, files, sort_order)
VALUES
(
    'GOV_RECOMMENDATION', 'KISA', '생성형 AI 보안', 'KISA',
    '생성형 AI 서비스 보안 가이드',
    'LLM 연동 서비스의 프롬프트 인젝션·민감정보 유출 대응 권고. API 키 분리 보관 및 출력 필터링 강조.',
    'https://www.kisa.or.kr/', '2026-06-01', '[]', 1
),
(
    'GOV_RECOMMENDATION', '행정안전부', 'SW 개발보안', '행정안전부',
    'SW 개발보안 가이드 개정(47개 항목)',
    '공공 정보화 사업 의무 적용 보안약점 진단 항목. 입력 검증·인증·에러처리 영역 보강.',
    'https://www.kisa.or.kr/2060204/form?postSeq=5&page=1', '2026-05-01', '[]', 2
),
(
    'GOV_RECOMMENDATION', '개인정보보호위원회', '개인정보보호', '개인정보보호위원회',
    '개인정보 안전성 확보조치 기준',
    '암호화·접근권한·접속기록 보관(최소 1년) 등 기술적·관리적 보호조치 의무 사항.',
    'https://www.pipc.go.kr/', '2026-04-01', '[]', 3
);

-- 최신 보안 뉴스 — 기존 page.tsx SECURITY_NEWS 배열 값 그대로 적재
-- (agency: 발행기관/출처, category: 태그)
INSERT INTO compliance_feed_items
    (section, agency, category, source, title, summary, source_url, published_date, files, sort_order)
VALUES
(
    'SECURITY_NEWS', '보안뉴스', '취약점', '보안뉴스',
    '오픈소스 인기 라이브러리서 원격코드실행(RCE) 취약점 발견 — 즉시 패치 권고',
    NULL, 'https://www.boannews.com/', '2026-06-27', '[]', 1
),
(
    'SECURITY_NEWS', 'KISA', '권고문', 'KISA',
    'Apache 계열 서버 대상 대규모 스캐닝 탐지 — 최신 버전 업데이트 및 접근통제 점검',
    NULL, 'https://www.boho.or.kr/', '2026-06-25', '[]', 2
),
(
    'SECURITY_NEWS', '데일리시큐', '랜섬웨어', '데일리시큐',
    '국내 제조업 대상 피싱 경유 랜섬웨어 다수 — 첨부파일 매크로 차단 강화 필요',
    NULL, 'https://www.dailysecu.com/', '2026-06-23', '[]', 3
),
(
    'SECURITY_NEWS', 'CVE', 'CVE', 'CVE',
    'CVE-2026-XXXXX: 널리 쓰이는 JSON 파서 역직렬화 취약점(CVSS 9.1)',
    NULL, 'https://nvd.nist.gov/', '2026-06-20', '[]', 4
);

-- 기관 보안 게시물 — compliance-feed.json items[] 값 그대로 적재
-- (원문 복제 금지 — summary 요약본만 저장, 원문은 source_url 링크)
INSERT INTO compliance_feed_items
    (section, agency, category, source, title, summary, source_url, published_date, files, sort_order)
VALUES
(
    'AGENCY_POST', 'KISA', '가이드라인 / 보안취약점·침해사고 대응', 'KISA',
    'SW 공급망 보안 강화 로드맵 발표(2026.06.)',
    '과학기술정보통신부와 국가정보원이 합동으로 ''AI 일상화 시대를 준비하는 소프트웨어 공급망 보안 강화 로드맵''을 수립했다. ①공급망 위협 예방 역량 강화 ②신속한 탐지·대응 체계 마련 ③정책·제도적 기반 조성의 3대 전략으로 구성된다.',
    'https://www.kisa.or.kr/2060204/form?postSeq=24&page=1', '2026-06-24',
    '[{"name":"260624_SW 공급망 보안 강화 로드맵.pdf","size":"2MB","type":"PDF"}]', 1
);
