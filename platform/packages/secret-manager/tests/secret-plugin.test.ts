// 시크릿 플러그인 테스트
// Design Ref: SVC-SECRETMGR-R24 Plan
// Plan SC: FR-SM.6
// CSAP: D-09, D-08

import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { secretPlugin } from '../src/secret-plugin.js';

describe('secretPlugin -- Fastify 통합', () => {
  it('secrets decorator가 등록된다', async () => {
    const app = Fastify();
    await app.register(secretPlugin, {
      managerOptions: { masterKey: 'plugin-test-key-32bytes-long!', expirationCheckIntervalMs: 0 },
    });
    await app.ready();

    expect(app.secrets).toBeDefined();
    expect(typeof app.secrets.set).toBe('function');
    expect(typeof app.secrets.get).toBe('function');

    await app.close();
  });

  it('/secrets/stats 엔드포인트가 통계를 반환한다', async () => {
    const app = Fastify();
    await app.register(secretPlugin, {
      managerOptions: { masterKey: 'stats-plugin-test-32bytes-long', expirationCheckIntervalMs: 0 },
    });
    await app.ready();

    app.secrets.set('DB_PASS', 'secret123');

    const res = await app.inject({ method: 'GET', url: '/secrets/stats' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.data.secretCount).toBe(1);

    await app.close();
  });

  it('exposeStats=false 시 통계 엔드포인트가 없다', async () => {
    const app = Fastify();
    await app.register(secretPlugin, {
      managerOptions: { masterKey: 'no-stats-test-key-32bytes-lo', expirationCheckIntervalMs: 0 },
      exposeStats: false,
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/secrets/stats' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('플러그인을 통해 시크릿을 암복호화할 수 있다', async () => {
    const app = Fastify();
    await app.register(secretPlugin, {
      managerOptions: { masterKey: 'encrypt-plugin-test-32bytes!!', expirationCheckIntervalMs: 0 },
    });
    await app.ready();

    app.secrets.set('API_KEY', 'sk-abc123');
    expect(app.secrets.get('API_KEY')).toBe('sk-abc123');

    await app.close();
  });

  it('onClose 시 리소스가 정리된다', async () => {
    const app = Fastify();
    await app.register(secretPlugin, {
      managerOptions: { masterKey: 'cleanup-test-key-32bytes-lon!', expirationCheckIntervalMs: 0 },
    });
    await app.ready();

    app.secrets.set('TEMP', 'value');
    await app.close();

    // destroy 후 비어있는지 확인
    expect(app.secrets.listNames()).toHaveLength(0);
  });
});
