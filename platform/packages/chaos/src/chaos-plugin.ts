// Fastify Chaos 플러그인
// Design Ref: SVC-CHAOS-R12 Plan
// Plan SC: FR-CHAOS.1, FR-CHAOS.4
// CSAP: D-07 가용성 -- 장애 주입 (테스트 환경 전용)

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { ChaosEngine } from './chaos-engine.js';

declare module 'fastify' {
  interface FastifyInstance {
    chaos: ChaosEngine;
  }
}

export interface ChaosPluginOptions {
  /** Chaos 기능 강제 비활성화 */
  disabled?: boolean;
}

/**
 * Fastify Chaos 플러그인
 *
 * FR-CHAOS.4: 테스트 환경에서만 활성화
 * - NODE_ENV === 'test' || NODE_ENV === 'development' 시만 동작
 * - 프로덕션 환경: 플러그인 등록만 되고 기능은 비활성화
 *
 * 등록 시:
 * - /chaos/faults (GET): 등록된 장애 목록
 * - /chaos/faults (POST): 장애 주입
 * - /chaos/faults/:id (DELETE): 장애 해제
 * - /chaos/stats (GET): 통계
 * - /chaos/reset (POST): 전체 해제
 */
export const chaosPlugin = fp(
  async (fastify: FastifyInstance, opts: ChaosPluginOptions) => {
    const engine = new ChaosEngine();

    if (opts.disabled) {
      engine.disable();
    }

    fastify.decorate('chaos', engine);

    // Chaos 관리 엔드포인트 (활성화 시만)
    if (engine.isEnabled()) {
      // 요청마다 장애 적용 검사
      fastify.addHook('onRequest', async (request, reply) => {
        // chaos 관리 엔드포인트는 제외
        if (request.url.startsWith('/chaos/')) return;
        // health 엔드포인트는 제외
        if (request.url === '/health' || request.url === '/ready') return;

        const fault = await engine.applyFault(request.url);
        if (fault && (fault.type === 'error' || fault.type === 'connection_failure')) {
          await (reply as FastifyReply).status(fault.errorCode ?? 500).send({
            success: false,
            error: {
              code: 'CHAOS_INJECTED',
              message: fault.errorMessage,
              type: fault.type,
            },
          });
        }
        // latency 유형은 이미 delay가 적용됨 (applyFault 내부에서 await)
      });

      // 장애 목록 조회
      fastify.get('/chaos/faults', async () => ({
        success: true,
        data: engine.listFaults(),
      }));

      // 장애 주입
      fastify.post('/chaos/faults', async (request) => {
        const config = request.body as {
          type: string;
          probability: number;
          targetPattern?: string;
          delayMs?: number;
          errorCode?: number;
          errorMessage?: string;
          durationMs?: number;
        };

        const id = engine.injectFault({
          type: config.type as 'latency' | 'error' | 'connection_failure',
          probability: config.probability,
          targetPattern: config.targetPattern,
          delayMs: config.delayMs,
          errorCode: config.errorCode,
          errorMessage: config.errorMessage,
          durationMs: config.durationMs,
        });

        return { success: true, data: { id } };
      });

      // 장애 해제
      fastify.delete('/chaos/faults/:id', async (request) => {
        const { id } = request.params as { id: string };
        const removed = engine.removeFault(id);
        return { success: removed };
      });

      // 통계
      fastify.get('/chaos/stats', async () => ({
        success: true,
        data: engine.getStats(),
      }));

      // 전체 해제
      fastify.post('/chaos/reset', async () => {
        engine.clearAllFaults();
        engine.clearEvents();
        return { success: true, message: '전체 장애 해제 및 이벤트 초기화 완료' };
      });
    }
  },
  {
    name: '@public-saas/chaos',
    fastify: '5.x',
  },
);
