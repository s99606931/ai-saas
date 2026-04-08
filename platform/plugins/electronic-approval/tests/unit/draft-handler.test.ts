// 전자결재 플러그인 핸들러 통합 테스트
// Design Ref: DESIGN-TEST-1
// Plan SC: FR-N17.1, FR-N17.3, FR-N17.4
// CSAP: D-08 접근 통제, D-12 입력 검증, D-06 감사 로그

import { describe, it, expect } from 'vitest';
import draftHandler from '../../src/handlers/draft.handler';

const AUTH_HEADERS = {
  'x-user-id': 'test-user-001',
  'x-tenant-id': 'test-tenant-001',
  'Content-Type': 'application/json',
};

// 인증 헤더 없는 요청용
const NO_AUTH_HEADERS = {
  'Content-Type': 'application/json',
};

function createRequest(
  method: string,
  path: string,
  options?: { headers?: Record<string, string>; body?: unknown },
): Request {
  const url = `http://localhost${path}`;
  const init: RequestInit = {
    method,
    headers: options?.headers ?? AUTH_HEADERS,
  };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
  }
  return new Request(url, init);
}

// ── 1. POST /drafts — 기안 생성 ──

describe('POST /drafts (기안 생성)', () => {
  it('유효한 기안을 생성하면 201을 반환한다', async () => {
    const res = await draftHandler.request('/drafts', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        title: '출장 품의서',
        content: '부산 출장 건 품의입니다.',
        category: 'general',
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('id');
    expect(data.status).toBe('draft');
    expect(data.tenantId).toBe('test-tenant-001');
  });

  // FR-N17.3: CSAP D-08 인증 없는 접근 거부
  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await draftHandler.request('/drafts', {
      method: 'POST',
      headers: NO_AUTH_HEADERS,
      body: JSON.stringify({
        title: '테스트', content: '본문', category: 'general',
      }),
    });
    expect(res.status).toBe(401);
  });

  // FR-N17.4: CSAP D-12 입력 검증 실패
  it('빈 제목을 전송하면 400을 반환한다', async () => {
    const res = await draftHandler.request('/drafts', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        title: '', content: '본문', category: 'general',
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('error');
  });

  it('잘못된 카테고리를 전송하면 400을 반환한다', async () => {
    const res = await draftHandler.request('/drafts', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        title: '제목', content: '본문', category: 'invalid',
      }),
    });
    expect(res.status).toBe(400);
  });
});

// ── 2. GET /drafts — 기안 목록 조회 ──

describe('GET /drafts (기안 목록 조회)', () => {
  it('인증된 사용자는 목록을 조회할 수 있다', async () => {
    const res = await draftHandler.request('/drafts', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await draftHandler.request('/drafts', {
      method: 'GET',
      headers: NO_AUTH_HEADERS,
    });
    expect(res.status).toBe(401);
  });
});

// ── 3. GET /drafts/:id — 기안 상세 조회 ──

describe('GET /drafts/:id (기안 상세 조회)', () => {
  it('인증된 사용자는 상세 정보를 조회할 수 있다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('id');
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001', {
      method: 'GET',
      headers: NO_AUTH_HEADERS,
    });
    expect(res.status).toBe(401);
  });
});

// ── 4. PUT /drafts/:id — 기안 수정 ──

describe('PUT /drafts/:id (기안 수정)', () => {
  it('유효한 수정 요청은 200을 반환한다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001', {
      method: 'PUT',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ title: '수정된 제목' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('updatedAt');
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001', {
      method: 'PUT',
      headers: NO_AUTH_HEADERS,
      body: JSON.stringify({ title: '수정' }),
    });
    expect(res.status).toBe(401);
  });

  it('빈 제목으로 수정하면 400을 반환한다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001', {
      method: 'PUT',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ title: '' }),
    });
    expect(res.status).toBe(400);
  });
});

// ── 5. DELETE /drafts/:id — 기안 삭제 ──

describe('DELETE /drafts/:id (기안 삭제)', () => {
  it('인증된 사용자는 기안을 삭제할 수 있다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001', {
      method: 'DELETE',
      headers: AUTH_HEADERS,
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('deleted', true);
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001', {
      method: 'DELETE',
      headers: NO_AUTH_HEADERS,
    });
    expect(res.status).toBe(401);
  });
});

// ── 6. POST /drafts/:id/lines — 결재선 설정 ──

describe('POST /drafts/:id/lines (결재선 설정)', () => {
  it('유효한 결재선을 설정하면 200을 반환한다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001/lines', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        approvers: [
          { userId: '550e8400-e29b-41d4-a716-446655440001', order: 1, type: 'serial', role: 'approver' },
          { userId: '550e8400-e29b-41d4-a716-446655440002', order: 2, type: 'serial', role: 'final-approver' },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('approvers');
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001/lines', {
      method: 'POST',
      headers: NO_AUTH_HEADERS,
      body: JSON.stringify({ approvers: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('빈 결재자 배열을 전송하면 400을 반환한다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001/lines', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ approvers: [] }),
    });
    expect(res.status).toBe(400);
  });
});

// ── 7. POST /drafts/:id/approve — 승인 ──

describe('POST /drafts/:id/approve (승인)', () => {
  it('인증된 사용자는 승인할 수 있다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001/approve', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ comment: '승인합니다' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('action', 'approved');
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001/approve', {
      method: 'POST',
      headers: NO_AUTH_HEADERS,
    });
    expect(res.status).toBe(401);
  });
});

// ── 8. POST /drafts/:id/reject — 반려 ──

describe('POST /drafts/:id/reject (반려)', () => {
  it('인증된 사용자는 반려할 수 있다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001/reject', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ comment: '수정 후 재제출 바랍니다' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('action', 'rejected');
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001/reject', {
      method: 'POST',
      headers: NO_AUTH_HEADERS,
    });
    expect(res.status).toBe(401);
  });
});

// ── 9. POST /drafts/:id/hold — 보류 ──

describe('POST /drafts/:id/hold (보류)', () => {
  it('인증된 사용자는 보류할 수 있다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001/hold', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ comment: '추가 검토 필요' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('action', 'held');
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await draftHandler.request('/drafts/test-id-001/hold', {
      method: 'POST',
      headers: NO_AUTH_HEADERS,
    });
    expect(res.status).toBe(401);
  });
});

// ── 10. GET /documents — 문서 목록 ──

describe('GET /documents (문서 목록 조회)', () => {
  it('인증된 사용자는 문서 목록을 조회할 수 있다', async () => {
    const res = await draftHandler.request('/documents', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
  });

  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await draftHandler.request('/documents', {
      method: 'GET',
      headers: NO_AUTH_HEADERS,
    });
    expect(res.status).toBe(401);
  });

  it('잘못된 상태 필터를 전송하면 400을 반환한다', async () => {
    const res = await draftHandler.request('/documents?status=invalid', {
      method: 'GET',
      headers: AUTH_HEADERS,
    });
    expect(res.status).toBe(400);
  });
});
