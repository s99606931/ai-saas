// 감사 체인 Fastify 플러그인
// Design Ref: SVC-AUDITCHAIN-R21 Plan
// Plan SC: FR-AC.6
// CSAP: D-06 침해사고 관리, D-10 접근 제어

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { AuditChain } from './audit-chain.js';

/**
 * Fastify 인스턴스 타입 확장
 */
declare module 'fastify' {
  interface FastifyInstance {
    auditChain: AuditChain;
  }
}

/**
 * 감사 플러그인 옵션
 */
export interface AuditPluginOptions extends FastifyPluginOptions {
  /** /audit/verify 엔드포인트 노출 여부 (기본: true) */
  exposeVerify?: boolean;
  /** /audit/stats 엔드포인트 노출 여부 (기본: true) */
  exposeStats?: boolean;
  /** /audit/entries 엔드포인트 노출 여부 (기본: true) */
  exposeEntries?: boolean;
  /** 기존 JSON Lines 데이터에서 복원 */
  initialData?: string;
}

async function auditPluginHandler(
  app: FastifyInstance,
  opts: AuditPluginOptions,
): Promise<void> {
  const chain = opts.initialData
    ? AuditChain.fromJsonLines(opts.initialData)
    : new AuditChain();

  const exposeVerify = opts.exposeVerify !== false;
  const exposeStats = opts.exposeStats !== false;
  const exposeEntries = opts.exposeEntries !== false;

  app.decorate('auditChain', chain);

  // 무결성 검증 엔드포인트
  if (exposeVerify) {
    app.get('/audit/verify', async () => {
      const result = chain.verify();
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    });
  }

  // 통계 엔드포인트
  if (exposeStats) {
    app.get('/audit/stats', async () => {
      const stats = chain.getStats();
      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    });
  }

  // 엔트리 조회 엔드포인트
  if (exposeEntries) {
    app.get('/audit/entries', async (request) => {
      const query = request.query as {
        from?: string;
        to?: string;
        actor?: string;
        action?: string;
        limit?: string;
        offset?: string;
      };

      const entries = chain.query({
        from: query.from,
        to: query.to,
        actor: query.actor,
        action: query.action,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return {
        success: true,
        data: {
          count: entries.length,
          total: chain.getLength(),
          entries,
        },
        timestamp: new Date().toISOString(),
      };
    });

    // 단일 엔트리 조회
    app.get('/audit/entries/:index', async (request, reply) => {
      const params = request.params as { index: string };
      const index = parseInt(params.index, 10);
      const entry = chain.getEntry(index);

      if (!entry) {
        reply.status(404);
        return {
          success: false,
          error: '감사 엔트리를 찾을 수 없습니다',
          code: 'AUDIT_ENTRY_NOT_FOUND',
        };
      }

      return {
        success: true,
        data: entry,
        timestamp: new Date().toISOString(),
      };
    });
  }
}

export const auditPlugin = fp(auditPluginHandler, {
  name: '@public-saas/audit-chain',
  fastify: '5.x',
});
