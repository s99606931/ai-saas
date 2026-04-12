// MTU-N332 API 버전 관리 테스트
import { describe, it, expect } from 'vitest';
import { ApiVersioningManagerService } from '../api-versioning-manager.js';

describe('MTU-N332 ApiVersioningManager', () => {
  const svc = new ApiVersioningManagerService('tenant-n332');

  it('FR-N332.1: 버전 등록', () => {
    const v = svc.register('users-api', 'v1', { endpoints: ['/users'] });
    expect(v).toBeDefined();
  });

  it('FR-N332.2: 호환성 검사', () => {
    const result = svc.checkCompat({ a: 1, b: 2 }, { a: 1, b: 2, c: 3 });
    expect(result).toBeDefined();
  });

  it('FR-N332.3: 마이그레이션 가이드', () => {
    const compat = svc.checkCompat({ a: 1 }, { a: 1, b: 2 });
    const guide = svc.guide('v1', 'v2', compat);
    expect(guide).toBeDefined();
  });

  it('FR-N332.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
