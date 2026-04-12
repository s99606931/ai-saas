// MTU-N373 BFF 자동 생성기 테스트
import { describe, it, expect } from 'vitest';
import { BffAutoGeneratorService, type ApiEndpoint, type ScreenSpec } from '../bff-auto-generator.js';

describe('MTU-N373 BffAutoGenerator', () => {
  const svc = new BffAutoGeneratorService('tenant-n373');

  const endpoints: ApiEndpoint[] = [
    { path: '/users/:id', method: 'GET', responseFields: ['id', 'name', 'email'], requiredPermissions: ['user:read'] },
    { path: '/orders', method: 'GET', responseFields: ['orderId', 'total'], requiredPermissions: ['order:read'] },
  ];

  it('FR-N373.1: BFF 엔드포인트 생성', () => {
    const screen: ScreenSpec = { screenId: 'dashboard', requiredFields: ['name', 'email', 'orderId'] };
    const bff = svc.generate(screen, endpoints);
    expect(bff.mergedFields).toContain('name');
    expect(bff.requiredPermissions).toContain('user:read');
  });

  it('FR-N373.2: 코드 생성', () => {
    const screen: ScreenSpec = { screenId: 'profile', requiredFields: ['name'] };
    const bff = svc.generate(screen, endpoints);
    const code = svc.generateCode(bff);
    expect(code).toContain('handleprofile');
  });

  it('FR-N373.3: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
