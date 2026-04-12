import { describe, it, expect } from 'vitest';
import {
  PromptVariantExperimenter,
  type ExperimentDef,
  type TrialResult,
} from '../prompt-variant-experimenter.js';

function baseDef(): ExperimentDef {
  return {
    id: 'exp1',
    name: '프롬프트 테스트',
    control: {
      id: 'c',
      label: '기본',
      template: '질문: {q}',
      weight: 0.5,
    },
    variants: [
      {
        id: 'v1',
        label: '변형1',
        template: '입력: {q}\n답변:',
        weight: 0.5,
      },
    ],
    minSamples: 5,
  };
}

function trial(
  sessionId: string,
  variantId: string,
  quality: number,
  latencyMs = 100,
  success = true,
): TrialResult {
  return { sessionId, variantId, quality, latencyMs, success };
}

describe('create (FR-R78.1, D-12)', () => {
  it('정의 생성', () => {
    const e = new PromptVariantExperimenter();
    e.create(baseDef());
    expect(e.getAuditLog().some((l) => l.action === 'CREATE')).toBe(true);
  });

  it('weight 합계 1 아니면 에러', () => {
    const e = new PromptVariantExperimenter();
    const def = baseDef();
    def.variants[0]!.weight = 0.3;
    expect(() => e.create(def)).toThrow('EXPERIMENT_WEIGHT_INVALID');
  });

  it('variant 유효성', () => {
    const e = new PromptVariantExperimenter();
    const def = baseDef();
    def.variants[0]!.template = '';
    expect(() => e.create(def)).toThrow('EXPERIMENT_VARIANT_INVALID');
  });
});

describe('assign (FR-R78.2)', () => {
  it('결정적 할당 — 같은 session은 같은 variant', () => {
    const e = new PromptVariantExperimenter();
    e.create(baseDef());
    const a = e.assign('exp1', 'sess-42');
    const b = e.assign('exp1', 'sess-42');
    expect(a).toBe(b);
  });

  it('균등 분배 — 100개 세션', () => {
    const e = new PromptVariantExperimenter();
    e.create(baseDef());
    const counts: Record<string, number> = {};
    for (let i = 0; i < 200; i += 1) {
      const v = e.assign('exp1', `sess-${i}`);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    // 0.5/0.5 분포, 편차 ≤ 15%p 허용 (표본 200)
    const c = counts['c'] ?? 0;
    const v1 = counts['v1'] ?? 0;
    expect(Math.abs(c / 200 - 0.5)).toBeLessThan(0.15);
    expect(Math.abs(v1 / 200 - 0.5)).toBeLessThan(0.15);
  });
});

describe('record + stats (FR-R78.3)', () => {
  it('결과 기록 + 평균 집계', () => {
    const e = new PromptVariantExperimenter();
    e.create(baseDef());
    e.recordResult('exp1', trial('s1', 'c', 0.5));
    e.recordResult('exp1', trial('s2', 'c', 0.7));
    e.recordResult('exp1', trial('s3', 'v1', 0.9));
    const stats = e.stats('exp1');
    const c = stats.find((s) => s.variantId === 'c');
    const v = stats.find((s) => s.variantId === 'v1');
    expect(c?.n).toBe(2);
    expect(c?.avgQuality).toBeCloseTo(0.6, 2);
    expect(v?.avgQuality).toBeCloseTo(0.9, 2);
  });

  it('알 수 없는 variant 에러', () => {
    const e = new PromptVariantExperimenter();
    e.create(baseDef());
    expect(() => e.recordResult('exp1', trial('s', 'zzz', 0.5))).toThrow(
      'EXPERIMENT_VARIANT_UNKNOWN',
    );
  });
});

describe('conclude (FR-R78.4)', () => {
  it('표본 부족 → running', () => {
    const e = new PromptVariantExperimenter();
    e.create(baseDef());
    e.recordResult('exp1', trial('s', 'c', 0.5));
    const v = e.conclude('exp1');
    expect(v.status).toBe('running');
  });

  it('변형 승리', () => {
    const e = new PromptVariantExperimenter();
    e.create(baseDef());
    for (let i = 0; i < 5; i += 1) {
      e.recordResult('exp1', trial(`c${i}`, 'c', 0.5));
      e.recordResult('exp1', trial(`v${i}`, 'v1', 0.9));
    }
    const v = e.conclude('exp1');
    expect(v.status).toBe('concluded');
    expect(v.winner).toBe('v1');
  });

  it('control 승리', () => {
    const e = new PromptVariantExperimenter();
    e.create(baseDef());
    for (let i = 0; i < 5; i += 1) {
      e.recordResult('exp1', trial(`c${i}`, 'c', 0.9));
      e.recordResult('exp1', trial(`v${i}`, 'v1', 0.5));
    }
    const v = e.conclude('exp1');
    expect(v.winner).toBe('c');
  });

  it('무승부 → inconclusive', () => {
    const e = new PromptVariantExperimenter();
    e.create(baseDef());
    for (let i = 0; i < 5; i += 1) {
      e.recordResult('exp1', trial(`c${i}`, 'c', 0.5));
      e.recordResult('exp1', trial(`v${i}`, 'v1', 0.51));
    }
    const v = e.conclude('exp1');
    expect(v.status).toBe('concluded');
    expect(v.winner).toBeUndefined();
    expect(v.reason).toBe('INCONCLUSIVE');
  });
});

describe('감사 (FR-R78.5, D-06)', () => {
  it('ASSIGN/RECORD/CONCLUDE 모두 기록', () => {
    const e = new PromptVariantExperimenter();
    e.create(baseDef());
    e.assign('exp1', 's1');
    e.recordResult('exp1', trial('s1', 'c', 0.5));
    for (let i = 0; i < 5; i += 1) {
      e.recordResult('exp1', trial(`c${i}`, 'c', 0.5));
      e.recordResult('exp1', trial(`v${i}`, 'v1', 0.9));
    }
    e.conclude('exp1');
    const log = e.getAuditLog();
    expect(log.some((l) => l.action === 'ASSIGN')).toBe(true);
    expect(log.some((l) => l.action === 'RECORD')).toBe(true);
    expect(log.some((l) => l.action === 'CONCLUDE')).toBe(true);
  });
});
