import { describe, it, expect, beforeEach } from 'vitest';
import { FederatedRAG, type FederatedResult } from '../federated-rag.js';

function mockNode(prefix: string, count = 5) {
  return async (_q: string, k: number): Promise<FederatedResult[]> =>
    Array.from({ length: Math.min(count, k) }, (_, i) => ({
      docId: `${prefix}-doc-${i}`,
      score: 1 - i * 0.1,
      sourceNode: prefix,
      snippet: `${prefix} content ${i}`,
    }));
}

describe('FederatedRAG 노드 관리 (FR-R60.1)', () => {
  it('노드 등록/조회', () => {
    const rag = new FederatedRAG();
    rag.registerNode({ id: 'n1', endpoint: 'http://a', weight: 1, healthy: true }, mockNode('n1'));
    expect(rag.listNodes().length).toBe(1);
  });

  it('잘못된 weight 거부', () => {
    const rag = new FederatedRAG();
    expect(() =>
      rag.registerNode({ id: 'n1', endpoint: '', weight: 0, healthy: true }, mockNode('n1')),
    ).toThrow('FED_INVALID_WEIGHT');
  });

  it('unregister', () => {
    const rag = new FederatedRAG();
    rag.registerNode({ id: 'n1', endpoint: '', weight: 1, healthy: true }, mockNode('n1'));
    rag.unregisterNode('n1');
    expect(rag.listNodes().length).toBe(0);
  });
});

describe('federatedSearch (FR-R60.2)', () => {
  let rag: FederatedRAG;
  beforeEach(() => {
    rag = new FederatedRAG();
    rag.registerNode({ id: 'n1', endpoint: '', weight: 1, healthy: true }, mockNode('n1'));
    rag.registerNode({ id: 'n2', endpoint: '', weight: 1, healthy: true }, mockNode('n2'));
    rag.registerNode({ id: 'n3', endpoint: '', weight: 1, healthy: true }, mockNode('n3'));
  });

  it('3 노드 병렬 검색 성공', async () => {
    const res = await rag.federatedSearch('hello', { topK: 5, minNodes: 2, timeoutMs: 500 });
    expect(res.length).toBeLessThanOrEqual(5);
    expect(res.length).toBeGreaterThan(0);
  });

  it('minNodes 미달 거부', async () => {
    const rag2 = new FederatedRAG();
    rag2.registerNode({ id: 'only', endpoint: '', weight: 1, healthy: true }, mockNode('only'));
    await expect(
      rag2.federatedSearch('q', { topK: 3, minNodes: 2, timeoutMs: 100 }),
    ).rejects.toThrow('FED_INSUFFICIENT_NODES');
  });

  it('노드 실패 시 부분 성공', async () => {
    const rag2 = new FederatedRAG();
    rag2.registerNode(
      { id: 'ok', endpoint: '', weight: 1, healthy: true },
      mockNode('ok'),
    );
    rag2.registerNode(
      { id: 'bad', endpoint: '', weight: 1, healthy: true },
      async () => {
        throw new Error('boom');
      },
    );
    const res = await rag2.federatedSearch('q', { topK: 3, minNodes: 1, timeoutMs: 200 });
    expect(res.length).toBeGreaterThan(0);
    const audit = rag2.getAuditLog();
    expect(audit.some((e) => e.action === 'PARTIAL_FAILURE')).toBe(true);
  });

  it('타임아웃 실패 처리', async () => {
    const rag2 = new FederatedRAG();
    rag2.registerNode(
      { id: 'slow', endpoint: '', weight: 1, healthy: true },
      async () => new Promise((r) => setTimeout(() => r([]), 200)),
    );
    rag2.registerNode(
      { id: 'fast', endpoint: '', weight: 1, healthy: true },
      mockNode('fast'),
    );
    const res = await rag2.federatedSearch('q', {
      topK: 3,
      minNodes: 1,
      timeoutMs: 50,
    });
    expect(res.length).toBeGreaterThan(0);
  });
});

describe('rrfMerge (FR-R60.3)', () => {
  it('랭크 결합 정상 동작', () => {
    const rag = new FederatedRAG();
    rag.registerNode({ id: 'n1', endpoint: '', weight: 1, healthy: true }, mockNode('n1'));
    rag.registerNode({ id: 'n2', endpoint: '', weight: 2, healthy: true }, mockNode('n2'));
    const m = new Map<string, FederatedResult[]>();
    m.set('n1', [
      { docId: 'A', score: 0.9, sourceNode: 'n1', snippet: '' },
      { docId: 'B', score: 0.8, sourceNode: 'n1', snippet: '' },
    ]);
    m.set('n2', [
      { docId: 'B', score: 0.95, sourceNode: 'n2', snippet: '' },
      { docId: 'A', score: 0.85, sourceNode: 'n2', snippet: '' },
    ]);
    const merged = rag.rrfMerge(m, 5);
    expect(merged.length).toBe(2);
    expect(merged[0]?.docId).toBeDefined();
  });
});

describe('Breaker (FR-R60.4)', () => {
  it('수동 트립', () => {
    const rag = new FederatedRAG();
    rag.registerNode({ id: 'n1', endpoint: '', weight: 1, healthy: true }, mockNode('n1'));
    rag.tripBreaker('n1');
    expect(rag.getBreakerState('n1')?.open).toBe(true);
  });

  it('연속 실패 자동 트립', async () => {
    const rag = new FederatedRAG();
    rag.registerNode(
      { id: 'fail', endpoint: '', weight: 1, healthy: true },
      async () => {
        throw new Error('nope');
      },
    );
    rag.registerNode(
      { id: 'ok', endpoint: '', weight: 1, healthy: true },
      mockNode('ok'),
    );
    for (let i = 0; i < 5; i++) {
      try {
        await rag.federatedSearch('q', { topK: 3, minNodes: 1, timeoutMs: 100 });
      } catch {
        /* ignore */
      }
    }
    const state = rag.getBreakerState('fail');
    expect(state?.open).toBe(true);
  });

  it('트립 후 reset 가능', () => {
    const rag = new FederatedRAG();
    rag.registerNode({ id: 'n1', endpoint: '', weight: 1, healthy: true }, mockNode('n1'));
    rag.tripBreaker('n1');
    rag.resetBreaker('n1');
    expect(rag.getBreakerState('n1')?.open).toBe(false);
  });
});

describe('enforceDataGrade (FR-R60.6) + 감사 (FR-R60.5)', () => {
  it('C/S 등급 차단', () => {
    const rag = new FederatedRAG();
    expect(() => rag.enforceDataGrade('C')).toThrow('BLOCKED');
  });

  it('federatedSearch에 grade=S 전달 시 차단', async () => {
    const rag = new FederatedRAG();
    rag.registerNode({ id: 'n1', endpoint: '', weight: 1, healthy: true }, mockNode('n1'));
    await expect(
      rag.federatedSearch('q', { topK: 3, minNodes: 1, timeoutMs: 100, grade: 'S' }),
    ).rejects.toThrow('BLOCKED');
  });

  it('감사 로그 기록', () => {
    const rag = new FederatedRAG();
    rag.registerNode({ id: 'n1', endpoint: '', weight: 1, healthy: true }, mockNode('n1'));
    expect(rag.getAuditLog().length).toBeGreaterThan(0);
  });
});
