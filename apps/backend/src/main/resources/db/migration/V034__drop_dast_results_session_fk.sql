-- dast_results.session_id FK 제거
-- DAST는 독립 실행(SAST 세션 없이도 가능)이므로 analysis_sessions 참조를 해제한다.
ALTER TABLE dast_results DROP CONSTRAINT IF EXISTS dast_results_session_id_fkey;
