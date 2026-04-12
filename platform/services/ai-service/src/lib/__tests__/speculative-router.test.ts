import { describe, it, expect, beforeEach } from 'vitest';
import {
  SpeculativeRouter,
  type DraftModel,
  type TargetModel,
} from '../speculative-router.js';

function makeDraft(modelId: string, tokens: string[]): DraftModel {
  return {
    modelId,
    async generate(_q: string, k: number) {
      return tokens.slice(0, k);
    },
  };
}

function makeTarget(modelId: string, accepted: number, replacement = 'X'): TargetModel {
  return {
    modelId,
    async verify(_q: string, draftTokens: string[]) {
      return {
        acceptedCount: Math.min(accepted, draftTokens.length),
        replacement,
      };
    },
    async generateDirect(_q: string, k: number) {
      return Array.from({ length: k }, (_v, i) => `T${i}`);
    },
  };
}

describe('SpeculativeRouter.selectDraft (FR-R50.1)', () => {
  it('짧은 쿼리는 첫 번째 draft 모델', () => {
    const draft1 = makeDraft('small-1', ['a', 'b', 'c', 'd']);
    const draft2 = makeDraft('small-2', ['e', 'f', 'g', 'h']);
    const target = makeTarget('big', 4);
    const router = new SpeculativeRouter([draft1, draft2], target);
    const sel = router.selectDraft({ text: 'short' });
    expect(sel?.modelId).toBe('small-1');
  });

  it('긴 쿼리는 마지막 draft 모델', () => {
    const draft1 = makeDraft('small-1', ['a', 'b', 'c', 'd']);
    const draft2 = makeDraft('small-2', ['e', 'f', 'g', 'h']);
    const target = makeTarget('big', 4);
    const router = new SpeculativeRouter([draft1, draft2], target);
    const sel = router.selectDraft({ text: 'x'.repeat(500), estimatedTokens: 200 });
    expect(sel?.modelId).toBe('small-2');
  });

  it('draft 모델 없으면 null', () => {
    const target = makeTarget('big', 4);
    const router = new SpeculativeRouter([], target);
    expect(router.selectDraft({ text: 'q' })).toBeNull();
  });
});

describe('SpeculativeRouter.speculate (FR-R50.2/R50.3)', () => {
  it('전체 채택 시 draft 토큰 사용', async () => {
    const draft = makeDraft('small', ['a', 'b', 'c', 'd']);
    const target = makeTarget('big', 4);
    const router = new SpeculativeRouter([draft], target);
    const result = await router.speculate({ text: 'q' });
    expect(result.acceptedCount).toBe(4);
    expect(result.tokens).toEqual(['a', 'b', 'c', 'd']);
    expect(result.fallback).toBe(false);
  });

  it('부분 채택 시 거부 위치에 replacement 추가', async () => {
    const draft = makeDraft('small', ['a', 'b', 'c', 'd']);
    const target = makeTarget('big', 2, 'Z');
    const router = new SpeculativeRouter([draft], target);
    const result = await router.speculate({ text: 'q' });
    expect(result.acceptedCount).toBe(2);
    expect(result.tokens).toEqual(['a', 'b', 'Z']);
  });

  it('0개 채택 시 replacement만 사용', async () => {
    const draft = makeDraft('small', ['a', 'b', 'c', 'd']);
    const target = makeTarget('big', 0, 'X');
    const router = new SpeculativeRouter([draft], target);
    const result = await router.speculate({ text: 'q' });
    expect(result.acceptedCount).toBe(0);
    expect(result.tokens).toEqual(['X']);
  });
});

describe('SpeculativeRouter N2SF', () => {
  it('C등급 차단', async () => {
    const draft = makeDraft('small', ['a', 'b']);
    const target = makeTarget('big', 2);
    const router = new SpeculativeRouter([draft], target);
    await expect(router.speculate({ text: 'q', dataGrade: 'C' })).rejects.toThrow('SPEC_DATA_GRADE_BLOCKED');
  });

  it('S등급 차단', async () => {
    const draft = makeDraft('small', ['a', 'b']);
    const target = makeTarget('big', 2);
    const router = new SpeculativeRouter([draft], target);
    await expect(router.speculate({ text: 'q', dataGrade: 'S' })).rejects.toThrow('SPEC_DATA_GRADE_BLOCKED');
  });
});

describe('SpeculativeRouter.shouldFallback (FR-R50.4)', () => {
  let router: SpeculativeRouter;
  let target: TargetModel;

  beforeEach(() => {
    target = makeTarget('big', 0, 'X');
    const draft = makeDraft('small', ['a', 'b', 'c', 'd']);
    router = new SpeculativeRouter([draft], target, {
      windowSize: 10,
      fallbackThreshold: 0.4,
    });
  });

  it('윈도우 부족 시 false', () => {
    expect(router.shouldFallback()).toBe(false);
  });

  it('낮은 채택률 누적 후 fallback 모드 진입', async () => {
    for (let i = 0; i < 6; i += 1) {
      await router.speculate({ text: 'q' });
    }
    expect(router.shouldFallback()).toBe(true);
    expect(router.isFallbackMode()).toBe(true);
  });

  it('fallback 모드 진입 후 selectDraft는 null', async () => {
    for (let i = 0; i < 6; i += 1) {
      await router.speculate({ text: 'q' });
    }
    expect(router.selectDraft({ text: 'q' })).toBeNull();
  });

  it('resetFallback 후 다시 draft 사용', async () => {
    for (let i = 0; i < 6; i += 1) {
      await router.speculate({ text: 'q' });
    }
    router.resetFallback();
    expect(router.isFallbackMode()).toBe(false);
    expect(router.selectDraft({ text: 'q' })).not.toBeNull();
  });
});

describe('SpeculativeRouter.stats (FR-R50.5)', () => {
  it('초기 통계는 0', () => {
    const target = makeTarget('big', 4);
    const router = new SpeculativeRouter([makeDraft('s', ['a'])], target);
    const s = router.stats();
    expect(s.totalSpeculations).toBe(0);
    expect(s.acceptanceRate).toBe(0);
  });

  it('전체 채택 시 acceptance rate 1.0', async () => {
    const draft = makeDraft('small', ['a', 'b', 'c', 'd']);
    const target = makeTarget('big', 4);
    const router = new SpeculativeRouter([draft], target);
    await router.speculate({ text: 'q' });
    const s = router.stats();
    expect(s.totalSpeculations).toBe(1);
    expect(s.acceptanceRate).toBeCloseTo(1, 2);
    expect(s.estimatedCostSavingPct).toBeCloseTo(100, 1);
  });

  it('부분 채택 시 acceptance rate 비례', async () => {
    const draft = makeDraft('small', ['a', 'b', 'c', 'd']);
    const target = makeTarget('big', 2);
    const router = new SpeculativeRouter([draft], target);
    await router.speculate({ text: 'q' });
    const s = router.stats();
    expect(s.acceptanceRate).toBeCloseTo(0.5, 2);
  });
});

describe('SpeculativeRouter.audit (FR-R50.6)', () => {
  it('speculate 호출 시 SPEC_SPECULATE 기록', async () => {
    const draft = makeDraft('small', ['a', 'b', 'c', 'd']);
    const target = makeTarget('big', 4);
    const router = new SpeculativeRouter([draft], target);
    await router.speculate({ text: 'q' });
    const log = router.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.action).toBe('SPEC_SPECULATE');
    expect(log[0]?.draftModel).toBe('small');
    expect(log[0]?.accepted).toBe(4);
  });

  it('fallback 모드에서 SPEC_FALLBACK 기록', async () => {
    const target = makeTarget('big', 0, 'X');
    const router = new SpeculativeRouter([], target);
    await router.speculate({ text: 'q' });
    const log = router.getAuditLog();
    expect(log[0]?.action).toBe('SPEC_FALLBACK');
    expect(log[0]?.draftModel).toBeNull();
  });
});

describe('SpeculativeRouter 통합', () => {
  it('fallback 모드 진입 후 totalFallbacks 증가', async () => {
    const draft = makeDraft('small', ['a', 'b', 'c', 'd']);
    const target = makeTarget('big', 0, 'X');
    const router = new SpeculativeRouter([draft], target, {
      windowSize: 4,
      fallbackThreshold: 0.5,
    });
    // 첫 호출 시점에는 windowSize/2 미달로 fallback 미진입
    await router.speculate({ text: 'q' });
    expect(router.isFallbackMode()).toBe(false);
    // 두 번째 호출 후 윈도우 충분 → fallback 진입
    await router.speculate({ text: 'q' });
    expect(router.isFallbackMode()).toBe(true);
    const beforeFallbacks = router.stats().totalFallbacks;
    // 다음 호출은 fallback 경로
    await router.speculate({ text: 'q' });
    expect(router.stats().totalFallbacks).toBe(beforeFallbacks + 1);
  });
});
