// Design Ref: MTU-ECO3 Design 2.1
// Plan SC: FR-ECO3.1~ECO3.4
import { Hono } from 'hono';
import { manifest } from './manifest';
import draftHandler from './handlers/draft.handler';

const app = new Hono();

// 헬스체크
app.get('/health', (c) => c.json({ status: 'ok', service: manifest.id, version: manifest.version }));

// API 라우트 등록
app.route('/api/v1', draftHandler);

process.stdout.write(`${manifest.name} 플러그인 기동: port ${manifest.port}\n`);

export default app;
export { manifest };
