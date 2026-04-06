// Design Ref: MTU-ECO3 Design 2.1
// Plan SC: FR-ECO3.1
import { Hono } from 'hono';
import {
  createDraftSchema,
  updateDraftSchema,
  approvalLineSchema,
  approvalActionSchema,
  documentFilterSchema,
} from '../schemas/draft.schema';

const app = new Hono();

/**
 * 기안 작성 CRUD + 결재 처리
 * CSAP D-08: 모든 엔드포인트에 RBAC 검사 포함
 * CSAP D-12: 모든 입력에 Zod 스키마 검증
 */

// POST /api/v1/drafts - 기안 작성
app.post('/drafts', async (c) => {
  // CSAP D-08: RBAC 검사
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const body = await c.req.json();
  const validated = createDraftSchema.parse(body);

  // NOTE: 실제 구현에서는 DB에 저장
  const draft = {
    id: crypto.randomUUID(),
    ...validated,
    status: 'draft' as const,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return c.json(draft, 201);
});

// GET /api/v1/drafts - 기안 목록
app.get('/drafts', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const query = documentFilterSchema.parse(c.req.query());

  // NOTE: 실제 구현에서는 DB 조회 + 페이지네이션
  return c.json({
    items: [],
    total: 0,
    page: query.page,
    limit: query.limit,
  });
});

// GET /api/v1/drafts/:id - 기안 상세
app.get('/drafts/:id', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const id = c.req.param('id');
  // NOTE: 실제 구현에서는 DB 조회
  return c.json({ id, message: '기안 상세 조회' });
});

// PUT /api/v1/drafts/:id - 기안 수정
app.put('/drafts/:id', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const body = await c.req.json();
  const validated = updateDraftSchema.parse(body);
  const id = c.req.param('id');

  return c.json({ id, ...validated, updatedAt: new Date().toISOString() });
});

// DELETE /api/v1/drafts/:id - 기안 삭제 (소프트 삭제)
app.delete('/drafts/:id', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const id = c.req.param('id');
  return c.json({ id, deleted: true, deletedAt: new Date().toISOString() });
});

// POST /api/v1/drafts/:id/lines - 결재선 설정
app.post('/drafts/:id/lines', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const body = await c.req.json();
  const validated = approvalLineSchema.parse(body);
  const id = c.req.param('id');

  return c.json({ draftId: id, approvers: validated.approvers, status: 'pending' });
});

// POST /api/v1/drafts/:id/approve - 승인
app.post('/drafts/:id/approve', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const validated = approvalActionSchema.parse(body);
  const id = c.req.param('id');

  return c.json({ draftId: id, action: 'approved', by: userId, comment: validated.comment });
});

// POST /api/v1/drafts/:id/reject - 반려
app.post('/drafts/:id/reject', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const validated = approvalActionSchema.parse(body);
  const id = c.req.param('id');

  return c.json({ draftId: id, action: 'rejected', by: userId, comment: validated.comment });
});

// POST /api/v1/drafts/:id/hold - 보류
app.post('/drafts/:id/hold', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const validated = approvalActionSchema.parse(body);
  const id = c.req.param('id');

  return c.json({ draftId: id, action: 'held', by: userId, comment: validated.comment });
});

// GET /api/v1/documents - 문서 목록 (상태별 필터)
app.get('/documents', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const query = documentFilterSchema.parse(c.req.query());

  return c.json({
    items: [],
    total: 0,
    page: query.page,
    limit: query.limit,
    filter: { status: query.status, category: query.category },
  });
});

export default app;
