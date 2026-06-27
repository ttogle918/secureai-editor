CREATE TABLE compliance_frameworks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_type        VARCHAR(50) NOT NULL,          -- CISO, HANAFOS, ISMS
    name            VARCHAR(100) NOT NULL,         -- e.g., '정보보호 관리체계 인증(ISMS-P)'
    version         VARCHAR(20) NOT NULL,          -- e.g., '2.5v'
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DEPRECATED
    description     TEXT,
    official_link   VARCHAR(500),                  -- 가이드라인 바로가기
    form_link       VARCHAR(500),                  -- 양식 다운로드 링크
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_framework_doctype_version UNIQUE (doc_type, version)
);

CREATE TABLE compliance_controls (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id    UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    control_id      VARCHAR(50) NOT NULL,          -- e.g., '1', '2.8.5'
    category        VARCHAR(100),                  -- e.g., '입력 데이터 검증 및 표현'
    name            VARCHAR(255) NOT NULL,         -- e.g., 'SQL 삽입', '입력 데이터 검증'
    related_vuln_types JSONB NOT NULL DEFAULT '[]',-- 매핑되는 취약점 타입 배열
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_control_id_framework UNIQUE (framework_id, control_id)
);

CREATE INDEX idx_compliance_framework_doctype ON compliance_frameworks(doc_type);
CREATE INDEX idx_compliance_control_framework ON compliance_controls(framework_id);

-- Insert initial HANAFOS data (행안부 43개 항목 V47 - SW개발보안가이드)
INSERT INTO compliance_frameworks (id, doc_type, name, version, description, official_link, form_link)
VALUES 
('11111111-1111-1111-1111-111111111111', 'HANAFOS', '행안부 SW개발보안 가이드', '2021v', '행정안전부 소프트웨어 보안약점 진단가이드 47개 항목 기반 체크리스트', 'https://www.kisa.or.kr/2060204/form?postSeq=5&page=1', 'https://www.kisa.or.kr/2060204/form?postSeq=5&page=1'),
('22222222-2222-2222-2222-222222222222', 'ISMS', 'ISMS-P 인증기준', '2.5v', '정보보호 및 개인정보보호 관리체계 인증기준(통제항목)', 'https://isms-p.or.kr/ntcn/rcsrm/selectGnrlRcsrmDetail.do', 'https://isms-p.or.kr/ntcn/rcsrm/selectGnrlRcsrmDetail.do'),
('33333333-3333-3333-3333-333333333333', 'CISO', 'CISO 우수사례집 기반 보고서', '1.0v', '사내 정보보호최고책임자 보고용 취약점 현황 보고서', 'https://www.boho.or.kr/kr/bbs/view.do?bbsId=B0000127&pageIndex=1&nttId=71946&menuNo=205021', null);

-- Seed basic controls for HANAFOS (using the previously hardcoded definitions)
INSERT INTO compliance_controls (framework_id, control_id, category, name, related_vuln_types) VALUES
('11111111-1111-1111-1111-111111111111', '1', '입력 데이터 검증 및 표현', 'SQL 삽입', '["SQL_INJECTION"]'),
('11111111-1111-1111-1111-111111111111', '2', '입력 데이터 검증 및 표현', '코드 삽입', '["CODE_INJECTION"]'),
('11111111-1111-1111-1111-111111111111', '3', '입력 데이터 검증 및 표현', '경로 조작 및 자원 삽입', '["PATH_TRAVERSAL"]'),
('11111111-1111-1111-1111-111111111111', '4', '입력 데이터 검증 및 표현', 'XSS', '["XSS", "STORED_XSS", "REFLECTED_XSS"]'),
('11111111-1111-1111-1111-111111111111', '5', '입력 데이터 검증 및 표현', '운영체제 명령어 삽입', '["OS_COMMAND_INJECTION"]');

-- Seed basic controls for ISMS-P
INSERT INTO compliance_controls (framework_id, control_id, category, name, related_vuln_types) VALUES
('22222222-2222-2222-2222-222222222222', '2.8.4', '소스 프로그램 보안', '소스 프로그램 보안', '["HARDCODED_SECRET", "SECRET_EXPOSURE", "HARDCODED_CREDENTIAL"]'),
('22222222-2222-2222-2222-222222222222', '2.8.5', '입력 데이터 검증', '입력 데이터 검증', '["SQL_INJECTION", "XSS", "CODE_INJECTION", "PATH_TRAVERSAL"]'),
('22222222-2222-2222-2222-222222222222', '2.8.6', '보안 기능', '보안 기능', '["WEAK_CRYPTO", "WEAK_KEY", "WEAK_RANDOM", "SENSITIVE_DATA_EXPOSURE"]');
