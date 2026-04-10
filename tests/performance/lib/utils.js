/**
 * k6 성능 테스트 공통 유틸리티
 * Design Ref: MTU-N171 §3.1
 * Plan SC: FR-PERF.1
 */

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 커스텀 메트릭
export const errorRate = new Rate('errors');
export const apiResponseTime = new Trend('api_response_time', true);

// 환경 변수 로드
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
export const AUTH_URL = __ENV.AUTH_URL || `${BASE_URL}/api/auth/login`;

/**
 * 인증 토큰 발급
 * CSAP D-08: 테스트 환경에서도 인증 필수
 */
export function getAuthToken() {
  const testUser = __ENV.TEST_USER || 'loadtest@example.go.kr';
  const testPass = __ENV.TEST_PASS || 'LoadTest2026!';

  const res = http.post(
    AUTH_URL,
    JSON.stringify({
      email: testUser,
      password: testPass,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth-login' },
    },
  );

  check(res, {
    '인증 성공 (200)': (r) => r.status === 200,
  });

  if (res.status === 200) {
    const body = JSON.parse(res.body);
    return body.accessToken;
  }
  return null;
}

/**
 * 인증 헤더 생성
 */
export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * API 호출 + 메트릭 기록
 */
export function apiCall(method, url, params, options = {}) {
  const fullUrl = `${BASE_URL}${url}`;
  const res =
    method === 'GET' ? http.get(fullUrl, params) : http.post(fullUrl, JSON.stringify(params.body || {}), params);

  apiResponseTime.add(res.timings.duration);
  errorRate.add(res.status >= 400);

  if (options.checks) {
    check(res, options.checks);
  }

  return res;
}

/**
 * 기준선 대비 회귀 Threshold 생성
 * Design Ref: §3.6 - P95 20% 초과 시 FAIL
 */
export function createThresholds(baselines) {
  const thresholds = {
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  };

  for (const [name, baseline] of Object.entries(baselines)) {
    const maxP95 = Math.ceil(baseline.p95 * 1.2);
    const maxP99 = Math.ceil(baseline.p99 * 1.5);
    thresholds[`http_req_duration{name:${name}}`] = [`p(95)<${maxP95}`, `p(99)<${maxP99}`];
  }

  return thresholds;
}
