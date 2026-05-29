-- HTML, Markdown 리포트 형식 추가 — format 컬럼 CHECK 제약조건 확장
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_format_check;
ALTER TABLE reports ADD CONSTRAINT reports_format_check
    CHECK (format IN ('PDF', 'JSON', 'HTML', 'MD'));
