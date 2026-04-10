// 워크플로우 플러그인 테스트
// Design Ref: SVC-WORKFLOW-R20 Plan
// Plan SC: FR-WF.7
// CSAP: D-10 접근 제어

import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { workflowPlugin } from '../src/workflow-plugin.js';
import { defineWorkflow } from '../src/workflow-definition.js';

describe('workflowPlugin -- Fastify 통합', () => {
  it('workflowEngine decorator가 등록된다', async () => {
    const app = Fastify();
    await app.register(workflowPlugin, {});
    await app.ready();

    expect(app.workflowEngine).toBeDefined();
    expect(typeof app.workflowEngine.register).toBe('function');
    expect(typeof app.workflowEngine.execute).toBe('function');

    await app.close();
  });

  it('/workflows/stats 엔드포인트가 통계를 반환한다', async () => {
    const app = Fastify();
    await app.register(workflowPlugin, {});
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/workflows/stats' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.registeredWorkflows).toBeDefined();
    expect(body.data.activeInstances).toBeDefined();
    expect(body.data.totalInstances).toBeDefined();

    await app.close();
  });

  it('/workflows/instances 엔드포인트가 인스턴스 목록을 반환한다', async () => {
    const app = Fastify();
    await app.register(workflowPlugin, {});
    await app.ready();

    // 워크플로우 등록 및 실행
    const workflow = defineWorkflow({
      name: 'plugin-test',
      version: '1.0.0',
      steps: [{ name: 'ok', execute: async () => ({}) }],
    });
    app.workflowEngine.register(workflow);
    await app.workflowEngine.execute('plugin-test', '1.0.0');

    const res = await app.inject({ method: 'GET', url: '/workflows/instances' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(1);
    expect(body.data.instances[0].workflowName).toBe('plugin-test');
    expect(body.data.instances[0].status).toBe('completed');

    await app.close();
  });

  it('/workflows/instances?status=completed 필터가 동작한다', async () => {
    const app = Fastify();
    await app.register(workflowPlugin, {});
    await app.ready();

    const okWorkflow = defineWorkflow({
      name: 'ok-wf',
      version: '1.0.0',
      steps: [{ name: 'ok', execute: async () => ({}) }],
    });
    const failWorkflow = defineWorkflow({
      name: 'fail-wf',
      version: '1.0.0',
      defaultMaxRetries: 0,
      steps: [{ name: 'bad', execute: async () => { throw new Error('실패'); } }],
    });

    app.workflowEngine.register(okWorkflow);
    app.workflowEngine.register(failWorkflow);
    await app.workflowEngine.execute('ok-wf', '1.0.0');
    await app.workflowEngine.execute('fail-wf', '1.0.0');

    const res = await app.inject({
      method: 'GET',
      url: '/workflows/instances?status=completed',
    });
    const body = JSON.parse(res.body);
    expect(body.data.count).toBe(1);
    expect(body.data.instances[0].status).toBe('completed');

    await app.close();
  });

  it('/workflows/instances/:id 엔드포인트가 상세 정보를 반환한다', async () => {
    const app = Fastify();
    await app.register(workflowPlugin, {});
    await app.ready();

    const workflow = defineWorkflow({
      name: 'detail-test',
      version: '1.0.0',
      steps: [{ name: 'ok', execute: async () => ({ result: 'done' }) }],
    });
    app.workflowEngine.register(workflow);
    const instance = await app.workflowEngine.execute('detail-test', '1.0.0');

    const res = await app.inject({
      method: 'GET',
      url: `/workflows/instances/${instance.id}`,
    });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(instance.id);
    expect(body.data.stepResults).toHaveLength(1);
    expect(body.data.context.result).toBe('done');

    await app.close();
  });

  it('존재하지 않는 인스턴스 조회 시 404', async () => {
    const app = Fastify();
    await app.register(workflowPlugin, {});
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/workflows/instances/nonexistent',
    });
    expect(res.statusCode).toBe(404);

    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('WORKFLOW_NOT_FOUND');

    await app.close();
  });

  it('exposeStats=false 시 통계 엔드포인트가 없다', async () => {
    const app = Fastify();
    await app.register(workflowPlugin, { exposeStats: false });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/workflows/stats' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('exposeInstances=false 시 인스턴스 엔드포인트가 없다', async () => {
    const app = Fastify();
    await app.register(workflowPlugin, {
      exposeInstances: false,
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/workflows/instances' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('실행 후 통계가 올바르게 갱신된다', async () => {
    const app = Fastify();
    await app.register(workflowPlugin, {});
    await app.ready();

    const workflow = defineWorkflow({
      name: 'stats-update',
      version: '1.0.0',
      steps: [{ name: 'ok', execute: async () => ({}) }],
    });
    app.workflowEngine.register(workflow);
    await app.workflowEngine.execute('stats-update', '1.0.0');
    await app.workflowEngine.execute('stats-update', '1.0.0');

    const res = await app.inject({ method: 'GET', url: '/workflows/stats' });
    const body = JSON.parse(res.body);
    expect(body.data.registeredWorkflows).toBe(1);
    expect(body.data.completedInstances).toBe(2);
    expect(body.data.totalInstances).toBe(2);

    await app.close();
  });
});
