// 워크플로우 엔진 Fastify 플러그인
// Design Ref: SVC-WORKFLOW-R20 Plan
// Plan SC: FR-WF.7
// CSAP: D-10 접근 제어

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { WorkflowEngine, type WorkflowEngineOptions } from './workflow-engine.js';

/**
 * Fastify 인스턴스 타입 확장
 */
declare module 'fastify' {
  interface FastifyInstance {
    workflowEngine: WorkflowEngine;
  }
}

/**
 * 워크플로우 플러그인 옵션
 */
export interface WorkflowPluginOptions extends FastifyPluginOptions {
  /** 워크플로우 엔진 옵션 */
  engineOptions?: WorkflowEngineOptions;
  /** /workflows/stats 엔드포인트 노출 여부 (기본: true) */
  exposeStats?: boolean;
  /** /workflows/instances 엔드포인트 노출 여부 (기본: true) */
  exposeInstances?: boolean;
}

async function workflowPluginHandler(
  app: FastifyInstance,
  opts: WorkflowPluginOptions,
): Promise<void> {
  const engine = new WorkflowEngine(opts.engineOptions);
  const exposeStats = opts.exposeStats !== false;
  const exposeInstances = opts.exposeInstances !== false;

  // decorator 등록
  app.decorate('workflowEngine', engine);

  // 통계 엔드포인트
  if (exposeStats) {
    app.get('/workflows/stats', async () => {
      const stats = engine.getStats();
      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    });
  }

  // 인스턴스 목록 엔드포인트
  if (exposeInstances) {
    app.get('/workflows/instances', async (request) => {
      const query = request.query as { status?: string };
      let instances;

      if (query.status) {
        instances = engine.getInstancesByStatus(query.status as 'completed' | 'failed' | 'running');
      } else {
        instances = engine.getAllInstances();
      }

      return {
        success: true,
        data: {
          count: instances.length,
          instances: instances.map((inst) => ({
            id: inst.id,
            workflowName: inst.workflowName,
            workflowVersion: inst.workflowVersion,
            status: inst.status,
            currentStepIndex: inst.currentStepIndex,
            stepCount: inst.stepResults.length,
            createdAt: inst.createdAt,
            completedAt: inst.completedAt,
            totalDurationMs: inst.totalDurationMs,
          })),
        },
        timestamp: new Date().toISOString(),
      };
    });

    // 인스턴스 상세 조회
    app.get('/workflows/instances/:id', async (request, reply) => {
      const params = request.params as { id: string };
      const instance = engine.getInstance(params.id);

      if (!instance) {
        reply.status(404);
        return {
          success: false,
          error: '워크플로우 인스턴스를 찾을 수 없습니다',
          code: 'WORKFLOW_NOT_FOUND',
        };
      }

      return {
        success: true,
        data: instance,
        timestamp: new Date().toISOString(),
      };
    });
  }
}

export const workflowPlugin = fp(workflowPluginHandler, {
  name: '@public-saas/workflow-engine',
  fastify: '5.x',
});
