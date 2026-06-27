INSERT INTO security_guidelines (category, sub_category, target_stack, title, content, metadata)
VALUES (
    'Information Exposure',
    'SENSITIVE_DATA_IN_URL',
    'common',
    'API URL 민감 정보 노출 및 난독화 검증',
    'API 설계 시 URL Path나 Query Parameter에 민감한 정보(이메일, 주민번호, 연속된 정수형 ID 등)를 직접 노출해서는 안 됩니다.
1. 사용자 식별자 등은 연속된 정수(Auto-increment ID) 대신 UUID를 사용하여 추측을 방지(IDOR 방어)해야 합니다.
2. PII(개인식별정보)나 인증 토큰은 URL 쿼리스트링이 아닌 Request Body(POST/PUT)나 Authorization 헤더를 통해 전달해야 합니다.
3. Nginx, Spring Cloud Gateway 등 인프라 설정에서 내부 전용 API 엔드포인트가 외부에 직접 노출되지 않도록 라우팅 및 난독화 설정이 관리되어야 합니다.
소스 코드 내 API 엔드포인트 정의(예: @GetMapping, @RequestMapping, @router.get 등)에서 위와 같은 안티 패턴이 발견되면 `SENSITIVE_DATA_IN_URL` 취약점으로 보고하세요.',
    '{"cwe": "CWE-200", "owasp": "A02:2021"}'
);
