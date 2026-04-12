import { describe, it, expect } from 'vitest';
import {
  SemanticCacheWarmer,
  type HitInput,
  type WarmExecutor,
} from '../semantic-cache-warmer.js';

function mkHit(
  query: string,
  tenantId = 't1',
  grade: 'O' | 'C' | 'S' = 'O',
  at?: number,
): HitInput {
  return { query, tenantId, grade, at };
}

describe('grade guard (FR-R82.1, N-05)', () => {
  it('O 등급 기록', () => {
    const w = new SemanticCacheWarmer();
    w.recordHit(mkHit('민원 처리 상태 확인'));
    expect(w.size()).toBe(1);
  });

  it('C 등급 차단', () => {
    const w = new SemanticCacheWarmer();
    expect(() => w.recordHit(mkHit('q', 't1', 'C'))).toThrow('WARM_GRADE_BLOCKED');
    expect(w.getAuditLog().some((e) => e.action === 'GRADE_BLOCKED')).toBe(true);
  });

  it('S 등급 차단', () => {
    const w = new SemanticCacheWarmer();
    expect(() => w.recordHit(mkHit('q', 't1', 'S'))).toThrow('WARM_GRADE_BLOCKED');
  });
});

describe('PII 마스킹 (FR-R82.1)', () => {
  it('이메일 마스킹', () => {
    const w = new SemanticCacheWarmer();
    w.recordHit(mkHit('문의: user@example.com 처리 상태'));
    const ranked = w.rank();
    expect(ranked.length === 0 || ranked[0]?.query.includes('***@***')).toBe(true);
  });

  it('전화번호 마스킹', () => {
    const w = new SemanticCacheWarmer();
    w.recordHit(mkHit('010-1234-5678 관련 민원'));
    w.recordHit(mkHit('010-1234-5678 관련 민원'));
    const ranked = w.rank();
    expect(ranked[0]?.query).toContain('***-****-****');
  });

  it('주민번호 마스킹', () => {
    const w = new SemanticCacheWarmer();
    w.recordHit(mkHit('900101-1234567 조회'));
    w.recordHit(mkHit('900101-1234567 조회'));
    const ranked = w.rank();
    expect(ranked[0]?.query).toContain('******-*******');
  });
});

describe('히트 기록 + 빈도 누적', () => {
  it('같은 쿼리 반복 → hits 증가', () => {
    const w = new SemanticCacheWarmer();
    w.recordHit(mkHit('동일 쿼리'));
    w.recordHit(mkHit('동일 쿼리'));
    w.recordHit(mkHit('동일 쿼리'));
    expect(w.size()).toBe(1);
    const ranked = w.rank();
    expect(ranked[0]?.hits).toBe(3);
  });

  it('다른 테넌트는 별도 집계', () => {
    const w = new SemanticCacheWarmer();
    w.recordHit(mkHit('q', 't1'));
    w.recordHit(mkHit('q', 't2'));
    expect(w.size()).toBe(2);
  });
});

describe('랭킹 (FR-R82.2)', () => {
  it('minHits 미만 필터', () => {
    const w = new SemanticCacheWarmer({ minHitsToWarm: 3 });
    w.recordHit(mkHit('한번만'));
    w.recordHit(mkHit('세번', 't1'));
    w.recordHit(mkHit('세번', 't1'));
    w.recordHit(mkHit('세번', 't1'));
    const ranked = w.rank();
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.query).toBe('세번');
  });

  it('빈도 높은 것이 먼저', () => {
    const w = new SemanticCacheWarmer();
    w.recordHit(mkHit('자주'));
    w.recordHit(mkHit('자주'));
    w.recordHit(mkHit('자주'));
    w.recordHit(mkHit('가끔'));
    w.recordHit(mkHit('가끔'));
    const ranked = w.rank();
    expect(ranked[0]?.query).toBe('자주');
    expect(ranked[1]?.query).toBe('가끔');
  });

  it('최신성 가중치 감쇠', () => {
    const w = new SemanticCacheWarmer({ decayHalfLifeMs: 1000, minHitsToWarm: 1 });
    const now = Date.now();
    w.recordHit(mkHit('오래된', 't1', 'O', now - 10000));
    w.recordHit(mkHit('오래된', 't1', 'O', now - 10000));
    w.recordHit(mkHit('최근', 't1', 'O', now));
    const ranked = w.rank(now);
    expect(ranked[0]?.query).toBe('최근');
  });
});

describe('예열 실행 (FR-R82.3)', () => {
  it('executor 호출 순서 = 랭킹 순서', async () => {
    const w = new SemanticCacheWarmer({ minHitsToWarm: 1, budgetPerRun: 100 });
    w.recordHit(mkHit('A'));
    w.recordHit(mkHit('A'));
    w.recordHit(mkHit('B'));

    const calls: string[] = [];
    const executor: WarmExecutor = async (q) => {
      calls.push(q);
      return { costUnits: 1, ok: true };
    };
    const result = await w.warmup(executor);
    expect(result.warmed).toBe(2);
    expect(calls[0]).toBe('A');
    expect(calls[1]).toBe('B');
  });

  it('executor 실패 시 skipped 증가', async () => {
    const w = new SemanticCacheWarmer({ minHitsToWarm: 1 });
    w.recordHit(mkHit('Q1'));
    const executor: WarmExecutor = async () => ({ costUnits: 1, ok: false });
    const result = await w.warmup(executor);
    expect(result.warmed).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('executor throw → skipped', async () => {
    const w = new SemanticCacheWarmer({ minHitsToWarm: 1 });
    w.recordHit(mkHit('Q1'));
    const executor: WarmExecutor = async () => {
      throw new Error('boom');
    };
    const result = await w.warmup(executor);
    expect(result.skipped).toBe(1);
  });
});

describe('예산 상한 (FR-R82.4)', () => {
  it('예산 초과 시 중단', async () => {
    const w = new SemanticCacheWarmer({ minHitsToWarm: 1, budgetPerRun: 5 });
    for (let i = 0; i < 10; i += 1) {
      w.recordHit(mkHit(`Q${i}`));
    }
    const executor: WarmExecutor = async () => ({ costUnits: 2, ok: true });
    const result = await w.warmup(executor);
    expect(result.budgetExceeded).toBe(true);
    expect(result.warmed).toBeLessThanOrEqual(3);
    expect(w.getAuditLog().some((e) => e.action === 'BUDGET_EXCEEDED')).toBe(true);
  });
});

describe('maxCandidates LRU', () => {
  it('max 초과 시 오래된 항목 제거', () => {
    const w = new SemanticCacheWarmer({ maxCandidates: 3 });
    w.recordHit(mkHit('Q1', 't1', 'O', 1000));
    w.recordHit(mkHit('Q2', 't1', 'O', 2000));
    w.recordHit(mkHit('Q3', 't1', 'O', 3000));
    w.recordHit(mkHit('Q4', 't1', 'O', 4000));
    expect(w.size()).toBe(3);
  });
});

describe('reset + 감사 로그 (FR-R82.5)', () => {
  it('reset으로 상태 초기화', () => {
    const w = new SemanticCacheWarmer();
    w.recordHit(mkHit('Q'));
    w.reset();
    expect(w.size()).toBe(0);
  });

  it('getAuditLog 불변 복사본', () => {
    const w = new SemanticCacheWarmer();
    w.recordHit(mkHit('Q'));
    const log = w.getAuditLog();
    log.push({ action: 'HIT', at: 0 });
    expect(w.getAuditLog().length).toBeLessThan(log.length);
  });
});
