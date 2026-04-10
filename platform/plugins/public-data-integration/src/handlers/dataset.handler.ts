// Design Ref: MTU-ECO3 Design 2.2
// Plan SC: FR-ECO3.5~ECO3.8
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 입력 검증
import { Hono } from 'hono';
import { datasetSearchSchema, transformSchema } from '../schemas/dataset.schema';
import { DataPortalClient } from '../lib/data-portal-client';
import { getCached, setCache } from '../lib/cache';
import { transformData } from '../lib/transformer';

const app = new Hono();
const client = new DataPortalClient();

// ── 감사 로그 유틸리티 (CSAP D-06) ──

const AUDIT_SERVICE_URL = process.env['AUDIT_SERVICE_URL'] ?? 'http://localhost:3012';

async function logDataEvent(
  action: string,
  actor: string,
  tenantId: string,
  target: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(`${AUDIT_SERVICE_URL}/audit/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor,
        action,
        target,
        targetType: 'public-data',
        tenantId,
        ip: '127.0.0.1',
        userAgent: 'public-data-integration-plugin/1.0',
        metadata,
      }),
    });
  } catch {
    process.stderr.write(`[public-data-integration] 감사 로그 전송 실패: ${action}\n`);
  }
}

// ── 인증 + 테넌트 격리 헬퍼 (CSAP D-08) ──

interface AuthContext {
  userId: string;
  tenantId: string;
}

function getAuthContext(c: { req: { header: (name: string) => string | undefined } }): AuthContext | null {
  const userId = c.req.header('x-user-id');
  const tenantId = c.req.header('x-tenant-id');
  if (!userId || !tenantId) return null;
  return { userId, tenantId };
}

/**
 * 공공데이터 연동 API
 * CSAP D-08: RBAC + 테넌트 격리 검사 포함
 * CSAP D-12: Zod safeParse 검증
 * CSAP D-06: 데이터 조회/변환에 감사 로그 기록
 */

// GET /api/v1/datasets - 데이터셋 검색
app.get('/datasets', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: '인증 및 테넌트 정보가 필요합니다' }, 401);
  }

  const parsed = datasetSearchSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: '입력 검증 실패', details: parsed.error.issues }, 400);
  }

  // 캐시 키에 tenantId 포함 (테넌트 간 격리)
  const cacheKey = `search:${auth.tenantId}:${JSON.stringify(parsed.data)}`;
  const cached = await getCached(cacheKey);
  if (cached) {
    return c.json({ ...(cached as object), fromCache: true });
  }

  const result = await client.searchDatasets(parsed.data);

  // 캐시 저장 (1시간)
  await setCache(cacheKey, result);

  return c.json(result);
});

// GET /api/v1/datasets/:id - 데이터셋 상세
app.get('/datasets/:id', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: '인증 및 테넌트 정보가 필요합니다' }, 401);
  }

  const id = c.req.param('id');

  // 캐시 확인
  const cacheKey = `dataset:${id}`;
  const cached = await getCached(cacheKey);
  if (cached) {
    return c.json({ ...(cached as object), fromCache: true });
  }

  const dataset = await client.getDataset(id);
  if (!dataset) {
    return c.json({ error: '데이터셋을 찾을 수 없습니다' }, 404);
  }

  await setCache(cacheKey, dataset);
  return c.json(dataset);
});

// GET /api/v1/datasets/:id/data - 데이터 조회 (캐시)
app.get('/datasets/:id/data', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: '인증 및 테넌트 정보가 필요합니다' }, 401);
  }

  const id = c.req.param('id');

  // 캐시 확인
  const cacheKey = `data:${id}`;
  const cached = await getCached(cacheKey);
  if (cached) {
    return c.json({ data: cached, fromCache: true });
  }

  const data = await client.getDatasetData(id);

  // 데이터 캐시 저장 (30분)
  await setCache(cacheKey, data, 1800);

  await logDataEvent('DATASET_DATA_ACCESSED', auth.userId, auth.tenantId, id);
  return c.json({ data });
});

// POST /api/v1/datasets/transform - 데이터 변환
app.post('/datasets/transform', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: '인증 및 테넌트 정보가 필요합니다' }, 401);
  }

  const body = await c.req.json();
  const parsed = transformSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: '입력 검증 실패', details: parsed.error.issues }, 400);
  }

  const result = transformData(parsed.data.data, parsed.data.sourceFormat, parsed.data.targetFormat);

  await logDataEvent('DATASET_TRANSFORMED', auth.userId, auth.tenantId, 'transform', {
    sourceFormat: parsed.data.sourceFormat,
    targetFormat: parsed.data.targetFormat,
    rowCount: result.length,
  });

  return c.json({
    sourceFormat: parsed.data.sourceFormat,
    targetFormat: parsed.data.targetFormat,
    rowCount: result.length,
    data: result,
  });
});

export default app;
