import { describe, it, expect, beforeEach } from 'vitest';
import {
  RetrievalFallbackChain,
  type RetrievalStage,
  type SearchResult,
  type StageKind,
} from '../retrieval-fallback-chain.js';

function stage(
  id: string,
  kind: StageKind,
  external: boolean,
  results: SearchResult[],
  opts: { fail?: boolean; delayMs?: number; timeoutMs?: number } = {},
): RetrievalStage {
  return {
    id,
    kind,
    external,
    timeoutMs: opts.timeoutMs ?? 200,
    run: async () => {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.fail) throw new Error('stage_failed');
      return results;
    },
  };
}

const LOW: SearchResult[] = [{ docId: 'x', score: 0.1, source: 'bm25', snippet: '' }];
const HIGH: SearchResult[] = [
  { docId: 'a', score: 0.95, source: 'dense', snippet: '' },
  { docId: 'b', score: 0.85, source: 'dense', snippet: '' },
];

describe('registerStage (FR-R62.1)', () => {
  it('정상 등록', () => {
    const c = new RetrievalFallbackChain();
    c.registerStage(stage('bm25', 'bm25', false, HIGH));
    expect(c.listStages().length).toBe(1);
  });

  it('중복 거부', () => {
    const c = new RetrievalFallbackChain();
    c.registerStage(stage('bm25', 'bm25', false, HIGH));
    expect(() => c.registerStage(stage('bm25', 'bm25', false, HIGH))).toThrow('CH_DUP_STAGE');
  });

  it('timeoutMs <= 0 거부', () => {
    const c = new RetrievalFallbackChain();
    expect(() =>
      c.registerStage({ ...stage('x', 'bm25', false, HIGH), timeoutMs: 0 }),
    ).toThrow('CH_INVALID_TIMEOUT');
  });
});

describe('restrictByGrade (FR-R62.5)', () => {
  it('C 등급은 external stage 제외', () => {
    const c = new RetrievalFallbackChain();
    c.registerStage(stage('bm25', 'bm25', false, HIGH));
    c.registerStage(stage('web', 'web', true, HIGH));
    const allowed = c.restrictByGrade('C');
    expect(allowed.length).toBe(1);
    expect(allowed[0]?.id).toBe('bm25');
  });

  it('O 등급은 모든 stage', () => {
    const c = new RetrievalFallbackChain();
    c.registerStage(stage('bm25', 'bm25', false, HIGH));
    c.registerStage(stage('web', 'web', true, HIGH));
    expect(c.restrictByGrade('O').length).toBe(2);
  });
});

describe('search() 체인 실행 (FR-R62.2~4)', () => {
  let chain: RetrievalFallbackChain;
  beforeEach(() => {
    chain = new RetrievalFallbackChain();
  });

  it('첫 단계 품질 충족 시 조기 종료', async () => {
    chain.registerStage(stage('bm25', 'bm25', false, HIGH));
    chain.registerStage(stage('dense', 'dense', false, HIGH));
    const r = await chain.search('q', {
      maxTotalMs: 1000,
      scoreThreshold: 0.5,
      grade: 'O',
      topK: 5,
    });
    expect(r.stagesRun.length).toBe(1);
    expect(r.succeededStage).toBe('bm25');
  });

  it('낮은 품질 → 다음 단계로', async () => {
    chain.registerStage(stage('bm25', 'bm25', false, LOW));
    chain.registerStage(stage('dense', 'dense', false, HIGH));
    const r = await chain.search('q', {
      maxTotalMs: 1000,
      scoreThreshold: 0.5,
      grade: 'O',
      topK: 5,
    });
    expect(r.stagesRun.length).toBe(2);
    expect(r.succeededStage).toBe('dense');
  });

  it('실패 stage는 다음 stage로', async () => {
    chain.registerStage(stage('bm25', 'bm25', false, HIGH, { fail: true }));
    chain.registerStage(stage('dense', 'dense', false, HIGH));
    const r = await chain.search('q', {
      maxTotalMs: 1000,
      scoreThreshold: 0.5,
      grade: 'O',
      topK: 5,
    });
    expect(r.succeededStage).toBe('dense');
    expect(chain.getAuditLog().some((e) => e.action === 'STAGE_FAIL')).toBe(true);
  });

  it('전체 exhaust', async () => {
    chain.registerStage(stage('bm25', 'bm25', false, LOW));
    chain.registerStage(stage('dense', 'dense', false, LOW));
    const r = await chain.search('q', {
      maxTotalMs: 1000,
      scoreThreshold: 0.9,
      grade: 'O',
      topK: 5,
    });
    expect(r.succeededStage).toBeNull();
    expect(r.results.length).toBeGreaterThan(0);  // best 반환
  });

  it('maxTotalMs 초과 시 중단', async () => {
    chain.registerStage(stage('slow1', 'bm25', false, LOW, { delayMs: 80, timeoutMs: 200 }));
    chain.registerStage(stage('slow2', 'dense', false, HIGH, { delayMs: 80, timeoutMs: 200 }));
    const r = await chain.search('q', {
      maxTotalMs: 120,
      scoreThreshold: 0.9,
      grade: 'O',
      topK: 5,
    });
    expect(r.totalMs).toBeLessThan(400);
  });
});

describe('C/S 등급 — 외부 stage만 있을 때', () => {
  it('allowed 0개 → 에러', async () => {
    const c = new RetrievalFallbackChain();
    c.registerStage(stage('web', 'web', true, HIGH));
    await expect(
      c.search('q', { maxTotalMs: 500, scoreThreshold: 0.5, grade: 'C', topK: 5 }),
    ).rejects.toThrow('BLOCKED');
  });

  it('enforceDataGrade 단독 호출', () => {
    const c = new RetrievalFallbackChain();
    expect(() => c.enforceDataGrade('S', true)).toThrow('BLOCKED');
    expect(() => c.enforceDataGrade('O', true)).not.toThrow();
  });
});

describe('evaluateQuality', () => {
  it('빈 결과 0점', () => {
    const c = new RetrievalFallbackChain();
    expect(c.evaluateQuality([])).toBe(0);
  });

  it('평균 점수', () => {
    const c = new RetrievalFallbackChain();
    const q = c.evaluateQuality([
      { docId: 'a', score: 0.8, source: 's', snippet: '' },
      { docId: 'b', score: 0.6, source: 's', snippet: '' },
    ]);
    expect(q).toBeCloseTo(0.7, 1);
  });
});

describe('getAuditLog (FR-R62.6)', () => {
  it('감사 누적', async () => {
    const c = new RetrievalFallbackChain();
    c.registerStage(stage('bm25', 'bm25', false, HIGH));
    await c.search('q', { maxTotalMs: 500, scoreThreshold: 0.5, grade: 'O', topK: 3 });
    const log = c.getAuditLog();
    expect(log.length).toBeGreaterThan(1);
    expect(log.some((e) => e.action === 'STAGE_RUN')).toBe(true);
  });

  it('limit 옵션', () => {
    const c = new RetrievalFallbackChain();
    c.registerStage(stage('a', 'bm25', false, HIGH));
    c.registerStage(stage('b', 'dense', false, HIGH));
    expect(c.getAuditLog(1).length).toBe(1);
  });
});
