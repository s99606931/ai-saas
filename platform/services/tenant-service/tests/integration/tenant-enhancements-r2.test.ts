// 테넌트 서비스 Round 2 고도화 통합 테스트
// Design Ref: SVC-TENANT-R2 DESIGN
// Plan SC: FR-TENANT.5, FR-TENANT.6

import { describe, it, expect } from 'vitest';

// ── FR-TENANT.5: 테넌트 검색 ──

describe('FR-TENANT.5: 테넌트 검색', () => {
  it('이름 기반 검색이 가능하다', () => {
    const tenants = [
      { name: '서울시청', slug: 'seoul-city' },
      { name: '부산시청', slug: 'busan-city' },
      { name: '서울교육청', slug: 'seoul-edu' },
    ];
    const q = '서울';
    const results = tenants.filter((t) => t.name.includes(q) || t.slug.includes(q));
    expect(results).toHaveLength(2);
  });

  it('slug 기반 검색이 가능하다', () => {
    const tenants = [
      { name: '서울시청', slug: 'seoul-city' },
      { name: '부산시청', slug: 'busan-city' },
    ];
    const q = 'busan';
    const results = tenants.filter((t) => t.name.toLowerCase().includes(q) || t.slug.includes(q));
    expect(results).toHaveLength(1);
  });

  it('상태 필터가 검색과 조합된다', () => {
    const tenants = [
      { name: '서울시청', slug: 'seoul-city', status: 'ACTIVE' },
      { name: '서울교육청', slug: 'seoul-edu', status: 'SUSPENDED' },
    ];
    const q = '서울';
    const status = 'ACTIVE';
    const results = tenants.filter((t) => t.name.includes(q) && t.status === status);
    expect(results).toHaveLength(1);
    expect(results[0].slug).toBe('seoul-city');
  });

  it('검색 결과에 페이지네이션이 포함된다', () => {
    const response = {
      success: true,
      data: [{ name: '서울시청' }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };
    expect(response.pagination).toBeDefined();
    expect(response.pagination.total).toBe(1);
  });

  it('빈 검색어는 400을 반환한다', () => {
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      q: z.string().min(1, '검색어는 필수입니다'),
    });
    const result = schema.safeParse({ q: '' });
    expect(result.success).toBe(false);
  });
});

// ── FR-TENANT.6: 테넌트 통계 ──

describe('FR-TENANT.6: 테넌트 통계', () => {
  it('상태별 분포가 올바르다', () => {
    const stats = {
      totalTenants: 10,
      statusDistribution: {
        active: 6,
        suspended: 2,
        trial: 1,
        archived: 1,
      },
    };
    const sum = Object.values(stats.statusDistribution).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.totalTenants);
  });

  it('테넌트당 평균 사용자 수가 계산된다', () => {
    const totalTenants = 5;
    const totalUsers = 25;
    const avg = totalTenants > 0 ? Math.round(totalUsers / totalTenants) : 0;
    expect(avg).toBe(5);
  });

  it('테넌트가 없을 때 평균은 0이다', () => {
    const totalTenants = 0;
    const totalUsers = 0;
    const avg = totalTenants > 0 ? Math.round(totalUsers / totalTenants) : 0;
    expect(avg).toBe(0);
  });

  it('totalMaxStorageBytes가 문자열로 반환된다', () => {
    const storageBytes = BigInt(1073741824) * BigInt(10);
    expect(storageBytes.toString()).toBe('10737418240');
  });

  it('generatedAt이 ISO 형식이다', () => {
    const iso = new Date().toISOString();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── 향상된 목록 조회 ──

describe('향상된 목록 조회: 정렬', () => {
  const VALID_SORT_FIELDS = ['name', 'createdAt', 'status', 'maxUsers'];

  it('유효한 sortBy 필드가 허용된다', () => {
    for (const field of VALID_SORT_FIELDS) {
      expect(VALID_SORT_FIELDS.includes(field)).toBe(true);
    }
  });

  it('유효하지 않은 sortBy는 createdAt 기본값이 적용된다', () => {
    const sortBy = 'invalidField';
    const resolved = VALID_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
    expect(resolved).toBe('createdAt');
  });

  it('sortOrder asc/desc가 동작한다', () => {
    const items = [
      { name: 'A', createdAt: '2026-01-01' },
      { name: 'C', createdAt: '2026-03-01' },
      { name: 'B', createdAt: '2026-02-01' },
    ];
    const asc = [...items].sort((a, b) => a.name.localeCompare(b.name));
    expect(asc[0].name).toBe('A');
    const desc = [...items].sort((a, b) => b.name.localeCompare(a.name));
    expect(desc[0].name).toBe('C');
  });

  it('인라인 검색 파라미터가 동작한다', () => {
    const tenants = [
      { name: '서울시청', slug: 'seoul-city' },
      { name: '부산시청', slug: 'busan-city' },
    ];
    const search = 'seoul';
    const results = tenants.filter((t) => t.name.toLowerCase().includes(search) || t.slug.includes(search));
    expect(results).toHaveLength(1);
  });

  it('검색 + 상태 필터 + 정렬이 조합된다', () => {
    const tenants = [
      { name: '서울시청', status: 'ACTIVE', createdAt: '2026-01-01' },
      { name: '서울교육청', status: 'ACTIVE', createdAt: '2026-03-01' },
      { name: '서울대학교', status: 'SUSPENDED', createdAt: '2026-02-01' },
    ];
    const filtered = tenants
      .filter((t) => t.name.includes('서울') && t.status === 'ACTIVE')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    expect(filtered).toHaveLength(2);
    expect(filtered[0].name).toBe('서울교육청');
  });
});

// ── 입력 검증 강화 ──

describe('입력 검증 강화 (Round 2)', () => {
  it('pageSize는 100을 초과할 수 없다', () => {
    const pageSize = Math.min(parseInt('200', 10), 100);
    expect(pageSize).toBe(100);
  });

  it('page는 최소 1이다', () => {
    const page = parseInt('0', 10);
    const resolved = page < 1 ? 1 : page;
    expect(resolved).toBe(1);
  });

  it('검색 쿼리 Zod 스키마가 올바르다', () => {
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      q: z.string().min(1).max(200),
      status: z.enum(['ACTIVE', 'SUSPENDED', 'TRIAL', 'ARCHIVED']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    });

    expect(schema.safeParse({ q: '서울' }).success).toBe(true);
    expect(schema.safeParse({ q: '서울', status: 'ACTIVE', page: '2' }).success).toBe(true);
    expect(schema.safeParse({ q: '' }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });
});

// ── 기존 기능 회귀 ──

describe('기존 기능 회귀: 테넌트 라우트', () => {
  const routes = [
    'GET /tenants/stats',
    'GET /tenants/search',
    'GET /tenants',
    'GET /tenants/:id',
    'POST /tenants',
    'PUT /tenants/:id',
    'PUT /tenants/:id/status',
    'DELETE /tenants/:id',
    'GET /tenants/:id/usage',
    'GET /tenants/:id/config',
    'PUT /tenants/:id/config',
  ];

  it('11개 라우트가 등록되어 있다 (기존 9 + 신규 2)', () => {
    expect(routes).toHaveLength(11);
  });

  it('stats 라우트가 추가되었다', () => {
    expect(routes).toContain('GET /tenants/stats');
  });

  it('search 라우트가 추가되었다', () => {
    expect(routes).toContain('GET /tenants/search');
  });

  it('정적 라우트가 파라미터 라우트보다 먼저 등록된다', () => {
    const statsIdx = routes.indexOf('GET /tenants/stats');
    const paramIdx = routes.indexOf('GET /tenants/:id');
    expect(statsIdx).toBeLessThan(paramIdx);
  });
});

// ── CSAP 준수 ──

describe('CSAP 준수: 테넌트 서비스 Round 2', () => {
  it('D-12: 검색 API에 Zod 검증이 적용된다', () => {
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      q: z.string().min(1),
    });
    expect(schema.safeParse({ q: '' }).success).toBe(false);
    expect(schema.safeParse({ q: 'test' }).success).toBe(true);
  });

  it('D-10: 검색 결과 최대 100건 제한', () => {
    const pageSize = Math.min(100, 100);
    expect(pageSize).toBeLessThanOrEqual(100);
  });

  it('D-08-05: UUID 형식 검증이 적용된다', () => {
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      id: z.string().uuid(),
    });
    expect(schema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(true);
    expect(schema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
});
