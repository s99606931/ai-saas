// 테넌트 격리 로직 단위 테스트
// Design Ref: DESIGN-MTU-P03
// Plan SC: FR-P03.5
// CSAP: N2SF N-03 격리 아키텍처

import { describe, it, expect } from 'vitest';
import { getTenantFilter } from '../../src/lib/isolation.js';
import type { TokenPayload } from '@public-saas/types';

function makeUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    sub: 'user-1',
    tenantId: 'tenant-abc',
    role: 'user',
    permissions: ['tenant:read'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
    ...overrides,
  };
}

describe('getTenantFilter (N2SF N-03)', () => {
  it('일반 사용자는 자신의 tenantId 필터를 받는다', () => {
    const user = makeUser({ role: 'user', tenantId: 'tenant-abc' });
    const filter = getTenantFilter(user);
    expect(filter).toEqual({ tenantId: 'tenant-abc' });
  });

  it('tenant_admin도 자신의 tenantId 필터를 받는다', () => {
    const user = makeUser({ role: 'tenant_admin', tenantId: 'tenant-xyz' });
    const filter = getTenantFilter(user);
    expect(filter).toEqual({ tenantId: 'tenant-xyz' });
  });

  it('viewer도 자신의 tenantId 필터를 받는다', () => {
    const user = makeUser({ role: 'viewer', tenantId: 'tenant-123' });
    const filter = getTenantFilter(user);
    expect(filter).toEqual({ tenantId: 'tenant-123' });
  });

  it('auditor도 자신의 tenantId 필터를 받는다', () => {
    const user = makeUser({ role: 'auditor', tenantId: 'tenant-gov' });
    const filter = getTenantFilter(user);
    expect(filter).toEqual({ tenantId: 'tenant-gov' });
  });

  it('super_admin은 빈 필터를 받는다 (전체 접근)', () => {
    const user = makeUser({ role: 'super_admin' });
    const filter = getTenantFilter(user);
    expect(filter).toEqual({});
    expect(filter.tenantId).toBeUndefined();
  });
});
