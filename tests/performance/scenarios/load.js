/**
 * k6 부하 테스트 (배포 후 자동 실행)
 * Design Ref: MTU-N171 §3.4
 * Plan SC: FR-PERF.4
 *
 * 목적: 정상 부하 조건에서 성능 기준선 준수 확인
 * 조건: 5분, 50 VU (ramp-up 1분 → 유지 3분 → ramp-down 1분)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getAuthToken, authHeaders, errorRate } from '../lib/utils.js';
import { BASELINES } from '../lib/baselines.js';
import { createThresholds } from '../lib/utils.js';

export const options = {
  stages: [
    { duration: '1m', target: 50 }, // ramp-up
    { duration: '3m', target: 50 }, // 유지
    { duration: '1m', target: 0 }, // ramp-down
  ],
  thresholds: {
    ...createThresholds(BASELINES),
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
  tags: {
    testType: 'load',
  },
};

export function setup() {
  const token = getAuthToken();
  return { token };
}

export default function (data) {
  const headers = authHeaders(data.token);

  // 시나리오 1: 헬스체크
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health-check' },
  });
  check(healthRes, { 'health 200': (r) => r.status === 200 });
  errorRate.add(healthRes.status >= 400);

  // 시나리오 2: 사용자 목록 조회
  const usersRes = http.get(`${BASE_URL}/api/users`, {
    headers,
    tags: { name: 'users-list' },
  });
  check(usersRes, { 'users 200': (r) => r.status === 200 });
  errorRate.add(usersRes.status >= 400);

  // 시나리오 3: 테넌트 목록
  const tenantsRes = http.get(`${BASE_URL}/api/tenants`, {
    headers,
    tags: { name: 'tenants-list' },
  });
  check(tenantsRes, { 'tenants 200': (r) => r.status === 200 });
  errorRate.add(tenantsRes.status >= 400);

  // 시나리오 4: 메뉴 목록
  const menuRes = http.get(`${BASE_URL}/api/menus`, {
    headers,
    tags: { name: 'menu-list' },
  });
  check(menuRes, { 'menus 200': (r) => r.status === 200 });
  errorRate.add(menuRes.status >= 400);

  // 시나리오 5: 감사 로그
  const auditRes = http.get(`${BASE_URL}/api/audit/logs?limit=20`, {
    headers,
    tags: { name: 'audit-logs' },
  });
  check(auditRes, { 'audit 200': (r) => r.status === 200 });
  errorRate.add(auditRes.status >= 400);

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
    '/tmp/k6-load-result.json': JSON.stringify(data),
  };
}
