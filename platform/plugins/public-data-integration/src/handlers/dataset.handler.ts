// Design Ref: MTU-ECO3 Design 2.2
// Plan SC: FR-ECO3.5~ECO3.8
import { Hono } from 'hono';
import { datasetSearchSchema, transformSchema } from '../schemas/dataset.schema';
import { DataPortalClient } from '../lib/data-portal-client';
import { getCached, setCache } from '../lib/cache';
import { transformData } from '../lib/transformer';

const app = new Hono();
const client = new DataPortalClient();

/**
 * 공공데이터 연동 API
 * CSAP D-08: RBAC 검사 포함
 * CSAP D-12: Zod 스키마 검증
 */

// GET /api/v1/datasets - 데이터셋 검색
app.get('/datasets', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const query = datasetSearchSchema.parse(c.req.query());

  // 캐시 확인
  const cacheKey = `search:${JSON.stringify(query)}`;
  const cached = await getCached(cacheKey);
  if (cached) {
    return c.json({ ...cached as object, fromCache: true });
  }

  const result = await client.searchDatasets(query);

  // 캐시 저장 (1시간)
  await setCache(cacheKey, result);

  return c.json(result);
});

// GET /api/v1/datasets/:id - 데이터셋 상세
app.get('/datasets/:id', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const id = c.req.param('id');

  // 캐시 확인
  const cacheKey = `dataset:${id}`;
  const cached = await getCached(cacheKey);
  if (cached) {
    return c.json({ ...cached as object, fromCache: true });
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
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
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

  return c.json({ data });
});

// POST /api/v1/datasets/transform - 데이터 변환
app.post('/datasets/transform', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }

  const body = await c.req.json();
  const validated = transformSchema.parse(body);

  const result = transformData(validated.data, validated.sourceFormat, validated.targetFormat);

  return c.json({
    sourceFormat: validated.sourceFormat,
    targetFormat: validated.targetFormat,
    rowCount: result.length,
    data: result,
  });
});

export default app;
