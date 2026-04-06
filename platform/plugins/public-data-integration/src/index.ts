// Design Ref: MTU-ECO3 Design 2.2
// Plan SC: FR-ECO3.5~ECO3.8
import { Hono } from 'hono';
import { manifest } from './manifest';
import datasetHandler from './handlers/dataset.handler';

const app = new Hono();

// 헬스체크
app.get('/health', (c) => c.json({ status: 'ok', service: manifest.id, version: manifest.version }));

// API 라우트 등록
app.route('/api/v1', datasetHandler);

console.log(`${manifest.name} 플러그인 기동: port ${manifest.port}`);

export default app;
export { manifest };
