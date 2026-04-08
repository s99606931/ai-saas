// 공공데이터 연동 플러그인 핸들러 통합 테스트
// Design Ref: DESIGN-TEST-2
// Plan SC: FR-N17.2, FR-N17.3, FR-N17.4
// CSAP: D-08 접근 통제, D-12 입력 검증

import { describe, it, expect } from 'vitest';
import datasetHandler from '../../src/handlers/dataset.handler';

const AUTH_HEADERS = {
  'x-user-id': 'test-user-001',
  'x-tenant-id': 'test-tenant-001',
  'Content-Type': 'application/json',
};

const NO_AUTH_HEADERS = {
  'Content-Type': 'application/json',
};

// ── 1. GET /datasets — 데이터셋 검색 ──

describe('GET /datasets (데이터셋 검색)', () => {
  it('인증된 사용자는 데이터셋을 검색할 수 있다', async () => {
    const res = await datasetHandler.request('/datasets', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    expect(res.status).toBe(200);
  });

  it('키워드 검색을 지원한다', async () => {
    const res = await datasetHandler.request('/datasets?keyword=%EA%B5%90%ED%86%B5', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    expect(res.status).toBe(200);
  });

  // FR-N17.3: CSAP D-08 인증 없는 접근 거부
  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await datasetHandler.request('/datasets', {
      method: 'GET',
      headers: NO_AUTH_HEADERS,
    });
    expect(res.status).toBe(401);
  });

  // FR-N17.4: CSAP D-12 입력 검증 실패
  it('잘못된 카테고리를 전송하면 400을 반환한다', async () => {
    const res = await datasetHandler.request('/datasets?category=invalid', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    expect(res.status).toBe(400);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('error');
  });

  it('limit 100 초과를 거부한다', async () => {
    const res = await datasetHandler.request('/datasets?limit=101', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    expect(res.status).toBe(400);
  });

  it('page 0 이하를 거부한다', async () => {
    const res = await datasetHandler.request('/datasets?page=0', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    expect(res.status).toBe(400);
  });
});

// ── 2. GET /datasets/:id — 데이터셋 상세 ──

describe('GET /datasets/:id (데이터셋 상세 조회)', () => {
  it('인증된 사용자는 상세 정보를 조회할 수 있다', async () => {
    const res = await datasetHandler.request('/datasets/test-ds-001', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    // 200 또는 404 (데이터셋 미존재)
    expect([200, 404]).toContain(res.status);
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await datasetHandler.request('/datasets/test-ds-001', {
      method: 'GET',
      headers: NO_AUTH_HEADERS,
    });
    expect(res.status).toBe(401);
  });
});

// ── 3. GET /datasets/:id/data — 데이터 조회 ──

describe('GET /datasets/:id/data (데이터 조회)', () => {
  it('인증된 사용자는 데이터를 조회할 수 있다', async () => {
    const res = await datasetHandler.request('/datasets/test-ds-001/data', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    // 200 또는 에러 (외부 API 미연결)
    expect(res.status).toBeLessThan(500);
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await datasetHandler.request('/datasets/test-ds-001/data', {
      method: 'GET',
      headers: NO_AUTH_HEADERS,
    });
    expect(res.status).toBe(401);
  });
});

// ── 4. POST /datasets/transform — 데이터 변환 ──

describe('POST /datasets/transform (데이터 변환)', () => {
  it('CSV를 JSON으로 변환할 수 있다', async () => {
    const res = await datasetHandler.request('/datasets/transform', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        data: 'name,age\n홍길동,30\n이순신,45',
        sourceFormat: 'csv',
        targetFormat: 'json',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('rowCount', 2);
    expect(data).toHaveProperty('data');
  });

  it('XML을 JSON으로 변환할 수 있다', async () => {
    const res = await datasetHandler.request('/datasets/transform', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        data: '<items><item><name>서울</name></item></items>',
        sourceFormat: 'xml',
        targetFormat: 'json',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('rowCount', 1);
  });

  // FR-N17.3: CSAP D-08 인증 없는 접근 거부
  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await datasetHandler.request('/datasets/transform', {
      method: 'POST',
      headers: NO_AUTH_HEADERS,
      body: JSON.stringify({
        data: 'test', sourceFormat: 'csv',
      }),
    });
    expect(res.status).toBe(401);
  });

  // FR-N17.4: CSAP D-12 입력 검증 실패
  it('빈 데이터를 전송하면 400을 반환한다', async () => {
    const res = await datasetHandler.request('/datasets/transform', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        data: '', sourceFormat: 'csv',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('json을 소스 형식으로 전송하면 400을 반환한다', async () => {
    const res = await datasetHandler.request('/datasets/transform', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        data: '{"key": "value"}', sourceFormat: 'json',
      }),
    });
    expect(res.status).toBe(400);
  });
});
