// 감사 체인 플러그인 테스트
// Design Ref: SVC-AUDITCHAIN-R21 Plan
// Plan SC: FR-AC.6
// CSAP: D-06, D-10

import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { auditPlugin } from '../src/audit-plugin.js';

describe('auditPlugin -- Fastify 통합', () => {
  it('auditChain decorator가 등록된다', async () => {
    const app = Fastify();
    await app.register(auditPlugin, {});
    await app.ready();

    expect(app.auditChain).toBeDefined();
    expect(typeof app.auditChain.append).toBe('function');
    expect(typeof app.auditChain.verify).toBe('function');

    await app.close();
  });

  it('/audit/verify 엔드포인트가 무결성 검증 결과를 반환한다', async () => {
    const app = Fastify();
    await app.register(auditPlugin, {});
    await app.ready();

    app.auditChain.append({ actor: 'admin', action: 'CREATE' });

    const res = await app.inject({ method: 'GET', url: '/audit/verify' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(true);
    expect(body.data.checkedCount).toBe(1);

    await app.close();
  });

  it('/audit/stats 엔드포인트가 통계를 반환한다', async () => {
    const app = Fastify();
    await app.register(auditPlugin, {});
    await app.ready();

    app.auditChain.append({ actor: 'admin', action: 'CREATE' });
    app.auditChain.append({ actor: 'user', action: 'READ' });

    const res = await app.inject({ method: 'GET', url: '/audit/stats' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.data.totalEntries).toBe(2);
    expect(body.data.latestHash).toBeDefined();

    await app.close();
  });

  it('/audit/entries 엔드포인트가 엔트리 목록을 반환한다', async () => {
    const app = Fastify();
    await app.register(auditPlugin, {});
    await app.ready();

    app.auditChain.append({ actor: 'admin', action: 'CREATE' });
    app.auditChain.append({ actor: 'user', action: 'READ' });

    const res = await app.inject({ method: 'GET', url: '/audit/entries' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.data.count).toBe(2);
    expect(body.data.total).toBe(2);
    expect(body.data.entries[0].actor).toBe('admin');

    await app.close();
  });

  it('/audit/entries?actor=admin 필터가 동작한다', async () => {
    const app = Fastify();
    await app.register(auditPlugin, {});
    await app.ready();

    app.auditChain.append({ actor: 'admin', action: 'CREATE' });
    app.auditChain.append({ actor: 'user', action: 'READ' });
    app.auditChain.append({ actor: 'admin', action: 'DELETE' });

    const res = await app.inject({
      method: 'GET',
      url: '/audit/entries?actor=admin',
    });
    const body = JSON.parse(res.body);
    expect(body.data.count).toBe(2);
    expect(body.data.entries.every((e: any) => e.actor === 'admin')).toBe(true);

    await app.close();
  });

  it('/audit/entries/:index 엔드포인트가 단일 엔트리를 반환한다', async () => {
    const app = Fastify();
    await app.register(auditPlugin, {});
    await app.ready();

    app.auditChain.append({ actor: 'admin', action: 'CREATE' });

    const res = await app.inject({
      method: 'GET',
      url: '/audit/entries/0',
    });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.data.actor).toBe('admin');
    expect(body.data.hash).toBeDefined();

    await app.close();
  });

  it('존재하지 않는 엔트리 조회 시 404', async () => {
    const app = Fastify();
    await app.register(auditPlugin, {});
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/audit/entries/99',
    });
    expect(res.statusCode).toBe(404);

    const body = JSON.parse(res.body);
    expect(body.code).toBe('AUDIT_ENTRY_NOT_FOUND');

    await app.close();
  });

  it('exposeVerify=false 시 검증 엔드포인트가 없다', async () => {
    const app = Fastify();
    await app.register(auditPlugin, { exposeVerify: false });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/audit/verify' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('exposeStats=false 시 통계 엔드포인트가 없다', async () => {
    const app = Fastify();
    await app.register(auditPlugin, { exposeStats: false });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/audit/stats' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('initialData에서 체인을 복원한다', async () => {
    // 기존 체인 생성
    const { AuditChain } = await import('../src/audit-chain.js');
    const original = new AuditChain();
    original.append({ actor: 'admin', action: 'SETUP' });
    const jsonl = original.toJsonLines();

    // 복원
    const app = Fastify();
    await app.register(auditPlugin, { initialData: jsonl });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/audit/stats' });
    const body = JSON.parse(res.body);
    expect(body.data.totalEntries).toBe(1);

    // 무결성 확인
    const verifyRes = await app.inject({ method: 'GET', url: '/audit/verify' });
    const verifyBody = JSON.parse(verifyRes.body);
    expect(verifyBody.data.valid).toBe(true);

    await app.close();
  });
});
