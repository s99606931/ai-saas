// MTU-N373 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  analyzeFieldCoverage,
  generateBffEndpoint,
  generateBffCode,
  getBffAuditLog,
  BffAutoGeneratorService,
  type ApiEndpoint,
  type ScreenSpec,
} from '../../src/lib/bff-auto-generator';

const endpoints: ApiEndpoint[] = [
  { path: '/users/me', method: 'GET', responseFields: ['name', 'email'], requiredPermissions: ['user:read'] },
  { path: '/tenants/me', method: 'GET', responseFields: ['tenantName', 'plan'], requiredPermissions: ['tenant:read'] },
  { path: '/billing', method: 'GET', responseFields: ['balance'], requiredPermissions: ['billing:read'] },
];

describe('MTU-N373 BffAutoGenerator', () => {
  it('필드 커버리지 분석', () => {
    const screen: ScreenSpec = { screenId: 'dashboard', requiredFields: ['name', 'tenantName'] };
    const r = analyzeFieldCoverage(screen, endpoints);
    expect(r.covered.length).toBe(2);
    expect(r.missing.length).toBe(0);
  });

  it('누락 필드 탐지', () => {
    const screen: ScreenSpec = { screenId: 'x', requiredFields: ['unknownField'] };
    const r = analyzeFieldCoverage(screen, endpoints);
    expect(r.missing).toContain('unknownField');
  });

  it('BFF 엔드포인트 생성', () => {
    const screen: ScreenSpec = { screenId: 'dashboard', requiredFields: ['name', 'tenantName', 'balance'] };
    const bff = generateBffEndpoint('t1', screen, endpoints);
    expect(bff.sourceEndpoints.length).toBe(3);
    expect(bff.requiredPermissions).toContain('user:read');
    expect(bff.requiredPermissions).toContain('billing:read');
  });

  it('누락 시 예외', () => {
    const screen: ScreenSpec = { screenId: 'x', requiredFields: ['missing'] };
    expect(() => generateBffEndpoint('t1', screen, endpoints)).toThrow(/필드 누락/);
  });

  it('BFF 코드 생성', () => {
    const bff = {
      screenId: 'dash',
      sourceEndpoints: ['GET /users/me'],
      mergedFields: ['name'],
      requiredPermissions: ['user:read'],
    };
    const code = generateBffCode(bff);
    expect(code).toContain('handledash');
    expect(code).toContain('user:read');
  });

  it('권한 중복 제거', () => {
    const eps: ApiEndpoint[] = [
      { path: '/a', method: 'GET', responseFields: ['f1'], requiredPermissions: ['p1'] },
      { path: '/b', method: 'GET', responseFields: ['f2'], requiredPermissions: ['p1'] },
    ];
    const bff = generateBffEndpoint('t1', { screenId: 's', requiredFields: ['f1', 'f2'] }, eps);
    expect(bff.requiredPermissions).toEqual(['p1']);
  });

  it('서비스 클래스 generate', () => {
    const svc = new BffAutoGeneratorService('t2');
    const bff = svc.generate({ screenId: 'x', requiredFields: ['name'] }, endpoints);
    expect(bff.screenId).toBe('x');
  });

  it('감사 로그 기록', () => {
    generateBffEndpoint('tenant-log', { screenId: 'sl', requiredFields: ['name'] }, endpoints);
    expect(getBffAuditLog('tenant-log').length).toBeGreaterThan(0);
  });

  it('감사 로그 테넌트 격리', () => {
    generateBffEndpoint('tA', { screenId: 'sa', requiredFields: ['name'] }, endpoints);
    generateBffEndpoint('tB', { screenId: 'sb', requiredFields: ['name'] }, endpoints);
    expect(getBffAuditLog('tA').every((e) => e.tenantId === 'tA')).toBe(true);
  });

  it('빈 필드 목록 처리', () => {
    const r = analyzeFieldCoverage({ screenId: 'e', requiredFields: [] }, endpoints);
    expect(r.covered.length).toBe(0);
  });
});
