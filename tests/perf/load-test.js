import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // 워밍업: 30초 동안 VU 20명으로 증가
    { duration: '1m',  target: 100 },  // 부하: 1분 동안 VU 100명으로 증가
    { duration: '30s', target: 0 },    // 쿨다운: 30초 동안 VU 0명으로 감소
  ],
  thresholds: {
    // p95 응답시간 500ms 미만
    http_req_duration: ['p(95)<500'],
    // 에러율 1% 미만
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://secureai-backend:8080';

export default function () {
  // 헬스체크 엔드포인트 — 인증 불필요, 전체 파이프라인 부하 측정
  const healthRes = http.get(`${BASE_URL}/actuator/health`);
  check(healthRes, { 'health 200': (r) => r.status === 200 });
  errorRate.add(healthRes.status !== 200);

  sleep(1);
}
