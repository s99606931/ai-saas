// 권한 조회 테스트
// Design Ref: DESIGN-MTU-P01 Section 5 RBAC
// Plan SC: FR-P01.1, FR-P01.3
// CSAP: D-08-05 역할 기반 접근 통제

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma 모킹
const mockPrisma = {
  rolePermission: {
    findMany: vi.fn(),
  },
};

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

describe('getUserPermissions (CSAP D-08-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('역할에 매핑된 권한 목록을 반환한다', async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValueOnce([
      { role: 'SUPER_ADMIN', permission: { name: 'admin:all' } },
      { role: 'SUPER_ADMIN', permission: { name: 'audit:read' } },
    ]);

    const { getUserPermissions } = await import('../../src/lib/permissions.js');
    const permissions = await getUserPermissions('SUPER_ADMIN');

    expect(permissions).toEqual(['admin:all', 'audit:read']);
    expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledWith({
      where: { role: 'SUPER_ADMIN' },
      include: { permission: true },
    });
  });

  it('권한이 없는 역할은 빈 배열을 반환한다', async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValueOnce([]);

    const { getUserPermissions } = await import('../../src/lib/permissions.js');
    const permissions = await getUserPermissions('VIEWER');

    expect(permissions).toEqual([]);
  });

  it('USER 역할은 기본 권한만 반환한다', async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValueOnce([
      { role: 'USER', permission: { name: 'profile:read' } },
      { role: 'USER', permission: { name: 'profile:update' } },
    ]);

    const { getUserPermissions } = await import('../../src/lib/permissions.js');
    const permissions = await getUserPermissions('USER');

    expect(permissions).toHaveLength(2);
    expect(permissions).toContain('profile:read');
    expect(permissions).toContain('profile:update');
  });
});
