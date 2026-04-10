/**
 * k6 스모크 테스트 (PR별 자동 실행)
 * Design Ref: MTU-N171 §3.3
 * Plan SC: FR-PERF.3
 *
 * 목적: 기본 기능 동작 확인 + 심각한 회귀 조기 탐지
 * 조건: 10초, 5 VU
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getAuthToken, authHeaders, errorRate } from '../lib/utils.js';
import { BASELINES } from '../lib/baselines.js';
import { createThresholds } from '../lib/utils.js';

export const options = {
  vus: 5,
  duration: '10s',
  thresholds: {
    ...createThresholds(BASELINES),
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
  },
  tags: {
    testType: 'smoke',
  },
};

export function setup() {
  const token = getAuthToken();
  return { token };
}

export default function (data) {
  const headers = authHeaders(data.token);

  // 헬스체크
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health-check' },
  });
  check(healthRes, {
    'health 200': (r) => r.status === 200,
  });
  errorRate.add(healthRes.status >= 400);

  // 사용자 목록
  const usersRes = http.get(`${BASE_URL}/api/users`, {
    headers,
    tags: { name: 'users-list' },
  });
  check(usersRes, {
    'users 200': (r) => r.status === 200,
  });
  errorRate.add(usersRes.status >= 400);

  // 테넌트 목록
  const tenantsRes = http.get(`${BASE_URL}/api/tenants`, {
    headers,
    tags: { name: 'tenants-list' },
  });
  check(tenantsRes, {
    'tenants 200': (r) => r.status === 200,
  });
  errorRate.add(tenantsRes.status >= 400);

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
    '/tmp/k6-smoke-result.json': JSON.stringify(data),
  };
}
