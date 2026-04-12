// MTU-N348 API 게이트웨이 라우터 테스트
import { describe, it, expect } from 'vitest';
import { ApiGatewayRouterService } from '../api-gateway-router.js';

describe('MTU-N348 ApiGatewayRouter', () => {
  const svc = new ApiGatewayRouterService('tenant-n348');

  it('FR-N348.1: 라우트 등록', () => {
    const route = svc.register('GET', '/api/users', 'users-service', true);
    expect(route).toBeDefined();
    expect(svc.routes().length).toBeGreaterThan(0);
  });

  it('FR-N348.2: 라우트 매칭', () => {
    svc.register('GET', '/api/orders', 'orders-service', true);
    const match = svc.match('GET', '/api/orders');
    expect(match).toBeDefined();
  });

  it('FR-N348.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
