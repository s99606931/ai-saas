/**
 * k6 소크 테스트 (야간 CronJob 실행)
 * Design Ref: MTU-N171 §3.5
 * Plan SC: FR-PERF.5
 *
 * 목적: 장시간 운영 안정성 (메모리 누수, 커넥션 풀 고갈 탐지)
 * 조건: 30분, 20 VU
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getAuthToken, authHeaders, errorRate } from '../lib/utils.js';
import { BASELINES } from '../lib/baselines.js';
import { createThresholds } from '../lib/utils.js';

export const options = {
  stages: [
    { duration: '2m', target: 20 }, // ramp-up
    { duration: '26m', target: 20 }, // 유지 (26분 지속)
    { duration: '2m', target: 0 }, // ramp-down
  ],
  thresholds: {
    ...createThresholds(BASELINES),
    http_req_failed: ['rate<0.005'],
    http_req_duration: ['p(95)<500'],
  },
  tags: {
    testType: 'soak',
  },
};

export function setup() {
  const token = getAuthToken();
  return { token };
}

export default function (data) {
  const headers = authHeaders(data.token);

  // 다양한 API 호출 패턴 (실제 사용 패턴 모사)
  const scenarios = [
    () => http.get(`${BASE_URL}/api/health`, { tags: { name: 'health-check' } }),
    () => http.get(`${BASE_URL}/api/users`, { headers, tags: { name: 'users-list' } }),
    () => http.get(`${BASE_URL}/api/tenants`, { headers, tags: { name: 'tenants-list' } }),
    () => http.get(`${BASE_URL}/api/menus`, { headers, tags: { name: 'menu-list' } }),
    () => http.get(`${BASE_URL}/api/catalog`, { headers, tags: { name: 'catalog-list' } }),
  ];

  // 랜덤 시나리오 선택
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  const res = scenario();

  check(res, {
    'status 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  errorRate.add(res.status >= 400);

  sleep(Math.random() * 2 + 0.5); // 0.5~2.5초 랜덤 대기
}

export function handleSummary(data) {
  return {
    '/tmp/k6-soak-result.json': JSON.stringify(data),
  };
}
