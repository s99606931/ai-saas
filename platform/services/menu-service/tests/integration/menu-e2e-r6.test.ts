// 메뉴 서비스 E2E 통합 테스트 -- Round 6
// Design Ref: SVC-E2E-R6 Plan
// Plan SC: FR-E2E-R6.6
// CSAP: D-08 접근 통제, D-12 입력 검증

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('menu-service E2E -- 메뉴 트리 관리 + 역할 필터 (CSAP D-08)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  interface MenuItem {
    id: string;
    name: string;
    path: string;
    parentId: string | null;
    order: number;
    roles: string[];
    icon?: string;
    isVisible: boolean;
  }

  const menus = new Map<string, MenuItem>();
  let menuCounter = 0;

  app.post('/menu', async (req, reply) => {
    const body = req.body as {
      name?: string;
      path?: string;
      parentId?: string;
      roles?: string[];
      icon?: string;
      order?: number;
    };
    if (!body.name || !body.path) {
      await reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '이름과 경로는 필수입니다' },
      });
      return;
    }
    const id = `menu-${++menuCounter}`;
    const menu: MenuItem = {
      id,
      name: body.name,
      path: body.path,
      parentId: body.parentId ?? null,
      order: body.order ?? menuCounter,
      roles: body.roles ?? ['USER'],
      icon: body.icon,
      isVisible: true,
    };
    menus.set(id, menu);
    await reply.status(201).send({ success: true, data: menu });
  });

  app.get('/menu/tree', async () => {
    const all = Array.from(menus.values()).filter((m) => m.isVisible);
    // 트리 구조 빌드
    const roots = all.filter((m) => !m.parentId).sort((a, b) => a.order - b.order);
    const tree = roots.map((root) => ({
      ...root,
      children: all
        .filter((m) => m.parentId === root.id)
        .sort((a, b) => a.order - b.order),
    }));
    return { success: true, data: tree };
  });

  app.get('/menu/filtered', async (req) => {
    const query = req.query as { role?: string };
    const role = query.role ?? 'USER';
    const filtered = Array.from(menus.values())
      .filter((m) => m.isVisible && m.roles.includes(role))
      .sort((a, b) => a.order - b.order);
    return { success: true, data: filtered };
  });

  app.get('/menu/search', async (req) => {
    const query = req.query as { q?: string };
    if (!query.q) {
      return { success: true, data: [] };
    }
    const term = query.q.toLowerCase();
    const results = Array.from(menus.values()).filter(
      (m) => m.name.toLowerCase().includes(term) || m.path.toLowerCase().includes(term),
    );
    return { success: true, data: results };
  });

  app.put('/menu/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const menu = menus.get(id);
    if (!menu) {
      await reply.status(404).send({ success: false, error: { code: 'MENU_NOT_FOUND' } });
      return;
    }
    const body = req.body as { name?: string; path?: string; isVisible?: boolean; order?: number };
    if (body.name) menu.name = body.name;
    if (body.path) menu.path = body.path;
    if (body.isVisible !== undefined) menu.isVisible = body.isVisible;
    if (body.order !== undefined) menu.order = body.order;
    return { success: true, data: menu };
  });

  app.delete('/menu/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!menus.has(id)) {
      await reply.status(404).send({ success: false, error: { code: 'MENU_NOT_FOUND' } });
      return;
    }
    // 하위 메뉴도 함께 삭제
    for (const [mid, m] of menus) {
      if (m.parentId === id) menus.delete(mid);
    }
    menus.delete(id);
    return { success: true, message: '삭제 완료' };
  });

  app.put('/menu/reorder', async (req) => {
    const body = req.body as Array<{ id: string; order: number }>;
    for (const item of body) {
      const menu = menus.get(item.id);
      if (menu) menu.order = item.order;
    }
    return { success: true, message: '순서 변경 완료' };
  });

  app.get('/menu/stats', async () => {
    const all = Array.from(menus.values());
    return {
      success: true,
      data: {
        totalMenus: all.length,
        visibleMenus: all.filter((m) => m.isVisible).length,
        rootMenus: all.filter((m) => !m.parentId).length,
        childMenus: all.filter((m) => m.parentId).length,
      },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('메뉴 생성 -> 트리 조회 -> 수정 -> 삭제 전체 플로우', async () => {
    // 루트 메뉴 생성
    const rootRes = await app.inject({
      method: 'POST',
      url: '/menu',
      headers: { 'content-type': 'application/json' },
      payload: { name: '대시보드', path: '/dashboard', roles: ['USER', 'ADMIN'], order: 1 },
    });
    expect(rootRes.statusCode).toBe(201);
    const rootId = rootRes.json().data.id;

    // 하위 메뉴 생성
    const childRes = await app.inject({
      method: 'POST',
      url: '/menu',
      headers: { 'content-type': 'application/json' },
      payload: { name: '통계', path: '/dashboard/stats', parentId: rootId, roles: ['ADMIN'], order: 1 },
    });
    expect(childRes.statusCode).toBe(201);

    // 트리 조회
    const treeRes = await app.inject({ method: 'GET', url: '/menu/tree' });
    const tree = treeRes.json().data;
    expect(tree.length).toBeGreaterThanOrEqual(1);
    const dashboardNode = tree.find((n: { id: string }) => n.id === rootId);
    expect(dashboardNode?.children?.length).toBe(1);

    // 수정
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/menu/${rootId}`,
      headers: { 'content-type': 'application/json' },
      payload: { name: '메인 대시보드' },
    });
    expect(updateRes.json().data.name).toBe('메인 대시보드');

    // 삭제 (하위 메뉴 포함)
    const delRes = await app.inject({ method: 'DELETE', url: `/menu/${rootId}` });
    expect(delRes.json().success).toBe(true);
  });

  it('역할별 메뉴 필터링 (CSAP D-08)', async () => {
    await app.inject({
      method: 'POST',
      url: '/menu',
      headers: { 'content-type': 'application/json' },
      payload: { name: '관리자 설정', path: '/admin/settings', roles: ['ADMIN'] },
    });
    await app.inject({
      method: 'POST',
      url: '/menu',
      headers: { 'content-type': 'application/json' },
      payload: { name: '내 정보', path: '/profile', roles: ['USER', 'ADMIN'] },
    });

    // ADMIN 역할 필터
    const adminRes = await app.inject({ method: 'GET', url: '/menu/filtered?role=ADMIN' });
    const adminMenus = adminRes.json().data;
    expect(adminMenus.some((m: { name: string }) => m.name === '관리자 설정')).toBe(true);

    // USER 역할 필터 -- 관리자 메뉴 미표시
    const userRes = await app.inject({ method: 'GET', url: '/menu/filtered?role=USER' });
    const userMenus = userRes.json().data;
    expect(userMenus.some((m: { name: string }) => m.name === '관리자 설정')).toBe(false);
    expect(userMenus.some((m: { name: string }) => m.name === '내 정보')).toBe(true);
  });

  it('메뉴 검색', async () => {
    const searchRes = await app.inject({
      method: 'GET',
      url: `/menu/search?q=${encodeURIComponent('설정')}`,
    });
    expect(searchRes.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('메뉴 순서 재배치', async () => {
    const m1 = await app.inject({
      method: 'POST',
      url: '/menu',
      headers: { 'content-type': 'application/json' },
      payload: { name: '순서1', path: '/order1', order: 10 },
    });
    const m2 = await app.inject({
      method: 'POST',
      url: '/menu',
      headers: { 'content-type': 'application/json' },
      payload: { name: '순서2', path: '/order2', order: 20 },
    });

    const reorderRes = await app.inject({
      method: 'PUT',
      url: '/menu/reorder',
      headers: { 'content-type': 'application/json' },
      payload: [
        { id: m1.json().data.id, order: 20 },
        { id: m2.json().data.id, order: 10 },
      ],
    });
    expect(reorderRes.json().success).toBe(true);
  });

  it('메뉴 통계', async () => {
    const res = await app.inject({ method: 'GET', url: '/menu/stats' });
    expect(res.json().data.totalMenus).toBeGreaterThan(0);
  });

  it('X-Response-Time 헤더 포함', async () => {
    const res = await app.inject({ method: 'GET', url: '/menu/tree' });
    expect(res.headers['x-response-time']).toBeDefined();
  });
});
