/**
 * API 성능 기준선 (Baseline) 정의
 * Design Ref: MTU-N171 §3.2
 * Plan SC: FR-PERF.2
 *
 * 각 API 엔드포인트의 허용 가능한 응답 시간 기준
 * P95 기준의 1.2배까지 허용 (20% 회귀 허용 마진)
 */

export const BASELINES = {
  'health-check': {
    p95: 50, // ms
    p99: 100,
    errorRate: 0,
  },
  'auth-login': {
    p95: 200,
    p99: 500,
    errorRate: 0.01,
  },
  'users-list': {
    p95: 150,
    p99: 300,
    errorRate: 0.005,
  },
  'tenants-list': {
    p95: 100,
    p99: 200,
    errorRate: 0.005,
  },
  'ai-query': {
    p95: 2000,
    p99: 5000,
    errorRate: 0.02,
  },
  'menu-list': {
    p95: 100,
    p99: 200,
    errorRate: 0.005,
  },
  'catalog-list': {
    p95: 150,
    p99: 300,
    errorRate: 0.005,
  },
  'audit-logs': {
    p95: 200,
    p99: 400,
    errorRate: 0.005,
  },
};
