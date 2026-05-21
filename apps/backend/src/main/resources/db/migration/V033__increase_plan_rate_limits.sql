-- 분당 API 요청 한도 상향 (이력 모달 등 다수 요청 시 즉각 초과 방지)
UPDATE plans SET api_rate_limit_per_min = 300  WHERE name = 'free';
UPDATE plans SET api_rate_limit_per_min = 600  WHERE name = 'pro';
UPDATE plans SET api_rate_limit_per_min = 1200 WHERE name = 'team';
-- enterprise는 -1(무제한) 유지
