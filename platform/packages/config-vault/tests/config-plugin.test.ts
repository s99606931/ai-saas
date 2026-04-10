// configPlugin 통합 테스트
// Design Ref: SVC-CONFIG-R16 Plan
// Plan SC: FR-CFG.1

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { configPlugin } from '../src/config-plugin.js';

describe('configPlugin -- Fastify 통합', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(configPlugin, {
      defaults: {
        app: { name: 'test-service', port: 3000 },
        db: { host: 'localhost', port: 5432 },
      },
      environmentConfig: {
        db: { host: 'staging-db' },
      },
      resolveSecrets: false, // 테스트에서는 시크릿 해석 비활성화
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('config decorator가 등록된다', () => {
    expect(app.config).toBeDefined();
    expect(typeof app.config.get).toBe('function');
    expect(typeof app.config.has).toBe('function');
    expect(typeof app.config.set).toBe('function');
    expect(typeof app.config.getAll).toBe('function');
  });

  it('기본 설정을 조회한다', () => {
    expect(app.config.get('app.name')).toBe('test-service');
    expect(app.config.get('app.port')).toBe(3000);
  });

  it('환경별 설정이 기본값을 덮어쓴다', () => {
    expect(app.config.get('db.host')).toBe('staging-db');
    expect(app.config.get('db.port')).toBe(5432); // 기본값 유지
  });

  it('런타임 설정을 변경한다', () => {
    app.config.set('app.port', 8080);
    expect(app.config.get('app.port')).toBe(8080);
  });

  it('has()로 설정 존재 여부를 확인한다', () => {
    expect(app.config.has('app.name')).toBe(true);
    expect(app.config.has('nonexistent')).toBe(false);
  });

  it('getAll()로 전체 설정을 반환한다', () => {
    const all = app.config.getAll();
    expect(all).toHaveProperty('app');
    expect(all).toHaveProperty('db');
  });
});

describe('configPlugin -- 스키마 검증', () => {
  it('스키마 검증 실패 시 에러를 발생한다', async () => {
    const app = Fastify({ logger: false });

    await expect(
      app.register(configPlugin, {
        defaults: { port: 'not-a-number' }, // number 기대
        schema: {
          port: { type: 'number', required: true },
          host: { type: 'string', required: true },
        },
        resolveSecrets: false,
      }),
    ).rejects.toThrow('설정 검증 실패');

    await app.close();
  });

  it('스키마 검증 통과 시 정상 시작한다', async () => {
    const app = Fastify({ logger: false });

    await app.register(configPlugin, {
      defaults: { port: 3000, host: 'localhost' },
      schema: {
        port: { type: 'number', required: true, min: 1, max: 65535 },
        host: { type: 'string', required: true },
      },
      resolveSecrets: false,
    });

    await app.ready();
    expect(app.config.get('port')).toBe(3000);

    await app.close();
  });
});
