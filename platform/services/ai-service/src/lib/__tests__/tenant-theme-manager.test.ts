// MTU-N333 테넌트 테마 관리 테스트
import { describe, it, expect } from 'vitest';
import { TenantThemeManagerService } from '../tenant-theme-manager.js';

describe('MTU-N333 TenantThemeManager', () => {
  const svc = new TenantThemeManagerService('tenant-n333');

  it('FR-N333.1: 테마 생성', () => {
    const t = svc.create('Corporate Blue');
    expect(t).toBeDefined();
    expect(svc.get()).toBeDefined();
  });

  it('FR-N333.2: CSS 변수 생성', () => {
    const t = svc.create('Default');
    const cssVars = svc.cssVars(t);
    expect(cssVars).toBeDefined();
  });

  it('FR-N333.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
