// 사용량 분석 테스트
// Design Ref: SVC-APIGW-R22 Plan
// Plan SC: FR-GW.3
// CSAP: D-08, D-10

import { describe, it, expect } from 'vitest';
import { UsageAnalytics } from '../src/usage-analytics.js';

describe('UsageAnalytics', () => {
  describe('FR-GW.3: 사용량 분석', () => {
    it('요청을 기록하고 리포트를 생성한다', () => {
      const analytics = new UsageAnalytics();
      analytics.record({
        method: 'GET',
        path: '/api/users',
        statusCode: 200,
        responseTimeMs: 50,
        tenantId: 'tenant-1',
      });

      const report = analytics.getReport();
      expect(report.totalRequests).toBe(1);
      expect(report.totalSuccess).toBe(1);
      expect(report.totalErrors).toBe(0);
      expect(report.endpoints).toHaveLength(1);
      expect(report.endpoints[0]!.method).toBe('GET');
      expect(report.endpoints[0]!.path).toBe('/api/users');
    });

    it('상태 코드별로 분류한다', () => {
      const analytics = new UsageAnalytics();
      analytics.record({ method: 'GET', path: '/api', statusCode: 200, responseTimeMs: 10 });
      analytics.record({ method: 'GET', path: '/api', statusCode: 201, responseTimeMs: 10 });
      analytics.record({ method: 'GET', path: '/api', statusCode: 404, responseTimeMs: 10 });
      analytics.record({ method: 'GET', path: '/api', statusCode: 500, responseTimeMs: 10 });

      const stats = analytics.getEndpointStats('GET', '/api');
      expect(stats!.successCount).toBe(2);
      expect(stats!.clientErrorCount).toBe(1);
      expect(stats!.serverErrorCount).toBe(1);
    });

    it('엔드포인트별로 독립 집계한다', () => {
      const analytics = new UsageAnalytics();
      analytics.record({ method: 'GET', path: '/users', statusCode: 200, responseTimeMs: 10 });
      analytics.record({ method: 'GET', path: '/users', statusCode: 200, responseTimeMs: 20 });
      analytics.record({ method: 'POST', path: '/users', statusCode: 201, responseTimeMs: 30 });

      const getStats = analytics.getEndpointStats('GET', '/users');
      const postStats = analytics.getEndpointStats('POST', '/users');

      expect(getStats!.totalRequests).toBe(2);
      expect(postStats!.totalRequests).toBe(1);
    });

    it('평균/최대 응답 시간을 계산한다', () => {
      const analytics = new UsageAnalytics();
      analytics.record({ method: 'GET', path: '/api', statusCode: 200, responseTimeMs: 10 });
      analytics.record({ method: 'GET', path: '/api', statusCode: 200, responseTimeMs: 30 });
      analytics.record({ method: 'GET', path: '/api', statusCode: 200, responseTimeMs: 20 });

      const stats = analytics.getEndpointStats('GET', '/api');
      expect(stats!.avgResponseTimeMs).toBe(20);
      expect(stats!.maxResponseTimeMs).toBe(30);
    });

    it('에러율을 계산한다', () => {
      const analytics = new UsageAnalytics();
      for (let i = 0; i < 8; i++) {
        analytics.record({ method: 'GET', path: '/api', statusCode: 200, responseTimeMs: 10 });
      }
      for (let i = 0; i < 2; i++) {
        analytics.record({ method: 'GET', path: '/api', statusCode: 500, responseTimeMs: 10 });
      }

      const report = analytics.getReport();
      expect(report.errorRate).toBe(20);
    });

    it('테넌트별 사용량을 추적한다', () => {
      const analytics = new UsageAnalytics();
      for (let i = 0; i < 5; i++) {
        analytics.record({ method: 'GET', path: '/api', statusCode: 200, responseTimeMs: 10, tenantId: 'tenant-a' });
      }
      for (let i = 0; i < 3; i++) {
        analytics.record({ method: 'GET', path: '/api', statusCode: 200, responseTimeMs: 10, tenantId: 'tenant-b' });
      }

      const report = analytics.getReport();
      expect(report.topTenants).toHaveLength(2);
      expect(report.topTenants[0]!.tenantId).toBe('tenant-a');
      expect(report.topTenants[0]!.requests).toBe(5);
    });

    it('리포트의 endpoints를 호출 수 내림차순으로 정렬한다', () => {
      const analytics = new UsageAnalytics();
      analytics.record({ method: 'GET', path: '/less', statusCode: 200, responseTimeMs: 10 });
      for (let i = 0; i < 5; i++) {
        analytics.record({ method: 'GET', path: '/more', statusCode: 200, responseTimeMs: 10 });
      }

      const report = analytics.getReport();
      expect(report.endpoints[0]!.path).toBe('/more');
    });

    it('존재하지 않는 엔드포인트 조회는 undefined', () => {
      const analytics = new UsageAnalytics();
      expect(analytics.getEndpointStats('GET', '/nothing')).toBeUndefined();
    });

    it('reset으로 모든 통계를 초기화한다', () => {
      const analytics = new UsageAnalytics();
      analytics.record({ method: 'GET', path: '/api', statusCode: 200, responseTimeMs: 10 });
      analytics.reset();

      const report = analytics.getReport();
      expect(report.totalRequests).toBe(0);
      expect(report.endpoints).toHaveLength(0);
    });

    it('빈 리포트의 기간은 null', () => {
      const analytics = new UsageAnalytics();
      const report = analytics.getReport();
      expect(report.periodStart).toBeNull();
      expect(report.periodEnd).toBeNull();
    });
  });
});
