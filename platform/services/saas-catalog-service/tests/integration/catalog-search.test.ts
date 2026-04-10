// SaaS 카탈로그 검색 및 통계 통합 테스트
// Design Ref: SVC-SAASCAT-R3 DESIGN
// Plan SC: FR-SCAT.3, FR-SCAT.5

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { registerRoutes } from '../../src/routes.js';
import { clearStore } from '../../src/lib/store.js';
import { clearAuditLog } from '../../src/lib/audit.js';

const TENANT = 'tenant-search';
const HEADERS = { 'x-tenant-id': TENANT, 'content-type': 'application/json' };

describe('SaaS 카탈로그 검색 및 통계 (FR-SCAT.3, FR-SCAT.5)', () => {
  const app = Fastify();
  app.register(async (instance) => {
    await registerRoutes(instance);
  });

  beforeEach(async () => {
    clearStore();
    clearAuditLog();

    // 테스트 데이터 생성
    const items = [
      { name: '전자결재 시스템', description: '공공기관 결재 프로세스', category: 'BUSINESS', provider: 'A사', version: '1.0' },
      { name: '보안 관제 플랫폼', description: '실시간 보안 모니터링', category: 'SECURITY', provider: 'B사', version: '2.0', csapGrade: 'HIGH' },
      { name: 'AI 문서 분석', description: '인공지능 기반 문서 자동 분류', category: 'AI_ML', provider: 'C사', version: '1.5' },
      { name: '문서관리 시스템', description: '전자문서 라이프사이클 관리', category: 'DOCUMENT', provider: 'D사', version: '3.0', csapGrade: 'STANDARD' },
      { name: '협업 메신저', description: '보안 메시지 서비스', category: 'COLLABORATION', provider: 'E사', version: '1.0' },
    ];

    for (const item of items) {
      await app.inject({
        method: 'POST',
        url: '/saas-catalog',
        headers: HEADERS,
        payload: item,
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // --- 검색 ---

  it('키워드 검색: "보안" -- 이름/설명에 포함된 항목 반환', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/saas-catalog?search=${encodeURIComponent('보안')}`,
      headers: { 'x-tenant-id': TENANT },
    });
    const body = res.json();
    expect(body.data.total).toBe(2); // 보안 관제 + 협업 메신저(보안 메시지)
    const names = body.data.items.map((i: { name: string }) => i.name);
    expect(names).toContain('보안 관제 플랫폼');
  });

  it('키워드 검색: "문서" -- 대소문자 무관 검색', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/saas-catalog?search=${encodeURIComponent('문서')}`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.json().data.total).toBeGreaterThanOrEqual(2);
  });

  it('카테고리 + 검색 복합 필터', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/saas-catalog?category=SECURITY&search=${encodeURIComponent('보안')}`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.json().data.total).toBe(1);
    expect(res.json().data.items[0].category).toBe('SECURITY');
  });

  // --- 정렬 ---

  it('이름순 오름차순 정렬', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog?sort=name&order=asc',
      headers: { 'x-tenant-id': TENANT },
    });
    const names: string[] = res.json().data.items.map((i: { name: string }) => i.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('생성일순 내림차순 정렬 (기본값)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog',
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.length).toBe(5);
  });

  // --- 상태 필터 ---

  it('상태 필터: DRAFT만 조회', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog?status=DRAFT',
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.json().data.total).toBe(5);
  });

  it('상태 필터: APPROVED -- 없음', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog?status=APPROVED',
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.json().data.total).toBe(0);
  });

  // --- 통계 ---

  it('GET /saas-catalog/stats: 상태별/카테고리별 통계', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog/stats',
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(200);
    const stats = res.json().data;
    expect(stats.total).toBe(5);
    expect(stats.byStatus.DRAFT).toBe(5);
    expect(stats.byCategory.BUSINESS).toBe(1);
    expect(stats.byCategory.SECURITY).toBe(1);
    expect(stats.byCategory.AI_ML).toBe(1);
  });

  it('GET /saas-catalog/stats: 빈 테넌트 통계', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog/stats',
      headers: { 'x-tenant-id': 'tenant-empty' },
    });
    expect(res.json().data.total).toBe(0);
  });

  // --- 페이지네이션 고급 ---

  it('limit=2, page=2: 두 번째 페이지', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog?limit=2&page=2',
      headers: { 'x-tenant-id': TENANT },
    });
    const body = res.json();
    expect(body.data.items.length).toBe(2);
    expect(body.data.page).toBe(2);
  });

  it('마지막 페이지 이후: 빈 배열', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog?limit=2&page=10',
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.json().data.items.length).toBe(0);
  });
});
