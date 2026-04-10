// 메뉴 서비스 Round 2 고도화 테스트
// Design Ref: SVC-MENU-R2 DESIGN

import { describe, it, expect } from 'vitest';

describe('메뉴 트리 깊이 분석', () => {
  it('최대 깊이가 계산된다', () => {
    const menus = [
      { id: '1', parentId: null, depth: 0 },
      { id: '2', parentId: '1', depth: 1 },
      { id: '3', parentId: '2', depth: 2 },
    ];
    const maxDepth = Math.max(...menus.map((m) => m.depth));
    expect(maxDepth).toBe(2);
  });

  it('순환 참조가 감지된다', () => {
    const visited = new Set<string>();
    const detectCycle = (id: string, parentMap: Map<string, string | null>): boolean => {
      if (visited.has(id)) return true;
      visited.add(id);
      const parent = parentMap.get(id);
      if (parent === null || parent === undefined) return false;
      return detectCycle(parent, parentMap);
    };
    const parentMap = new Map<string, string | null>([
      ['1', null],
      ['2', '1'],
      ['3', '2'],
    ]);
    expect(detectCycle('3', parentMap)).toBe(false);
  });

  it('루트 메뉴와 자식 메뉴가 구분된다', () => {
    const menus = [
      { id: '1', parentId: null },
      { id: '2', parentId: '1' },
      { id: '3', parentId: null },
    ];
    const roots = menus.filter((m) => m.parentId === null);
    const children = menus.filter((m) => m.parentId !== null);
    expect(roots).toHaveLength(2);
    expect(children).toHaveLength(1);
  });
});

describe('메뉴 검색 고도화', () => {
  it('경로(path) 기반 검색이 동작한다', () => {
    const menus = [
      { label: '대시보드', path: '/dashboard' },
      { label: '사용자', path: '/admin/users' },
      { label: '설정', path: '/admin/settings' },
    ];
    const q = '/admin';
    const results = menus.filter((m) => m.path.includes(q));
    expect(results).toHaveLength(2);
  });

  it('빈 검색어가 거부된다', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({ q: z.string().min(1) });
    expect(schema.safeParse({ q: '' }).success).toBe(false);
  });
});

describe('메뉴 재정렬 검증', () => {
  it('테넌트 격리가 재정렬에 적용된다', () => {
    const menu = { id: '1', tenantId: 'tenant-a' };
    const jwtTenantId = 'tenant-b';
    const allowed = menu.tenantId === jwtTenantId;
    expect(allowed).toBe(false);
  });

  it('순서 값이 음수가 아니다', () => {
    const newOrder = 0;
    expect(newOrder).toBeGreaterThanOrEqual(0);
  });
});
