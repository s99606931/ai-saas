import { describe, it, expect, beforeEach } from 'vitest';
import { AiWatermarkAdvanced } from '../ai-watermark-advanced.js';

const VOCAB = Array.from({ length: 40 }, (_, i) => `tok${i}`);
const CONFIG = {
  vocabulary: VOCAB,
  gamma: 0.5,
  delta: 2.0,
  zThreshold: 2.0,
  secret: 'test-secret-r58',
};

describe('AiWatermarkAdvanced 생성자', () => {
  it('빈 vocab 거부', () => {
    expect(() => new AiWatermarkAdvanced({ ...CONFIG, vocabulary: [] })).toThrow(
      'WM_EMPTY_VOCAB',
    );
  });
  it('시크릿 미지정 + env 없음 시 거부', () => {
    const prev = process.env['AI_WATERMARK_SECRET'];
    delete process.env['AI_WATERMARK_SECRET'];
    try {
      expect(
        () => new AiWatermarkAdvanced({ ...CONFIG, secret: undefined }),
      ).toThrow('WM_MISSING_SECRET');
    } finally {
      if (prev !== undefined) process.env['AI_WATERMARK_SECRET'] = prev;
    }
  });
  it('잘못된 gamma 거부', () => {
    expect(() => new AiWatermarkAdvanced({ ...CONFIG, gamma: 0 })).toThrow(
      'WM_INVALID_GAMMA',
    );
    expect(() => new AiWatermarkAdvanced({ ...CONFIG, gamma: 1 })).toThrow(
      'WM_INVALID_GAMMA',
    );
  });
});

describe('AiWatermarkAdvanced.buildGreenList (FR-R58.1)', () => {
  let wm: AiWatermarkAdvanced;
  beforeEach(() => {
    wm = new AiWatermarkAdvanced(CONFIG);
  });

  it('같은 context는 결정론적 그린리스트', () => {
    const g1 = wm.buildGreenList('ctx-1');
    const g2 = wm.buildGreenList('ctx-1');
    expect([...g1].sort()).toEqual([...g2].sort());
  });

  it('다른 context는 다른 그린리스트', () => {
    const g1 = wm.buildGreenList('ctx-1');
    const g2 = wm.buildGreenList('ctx-2');
    const arr1 = [...g1].sort().join(',');
    const arr2 = [...g2].sort().join(',');
    expect(arr1).not.toBe(arr2);
  });

  it('gamma 비율에 근접한 크기', () => {
    const g = wm.buildGreenList('ctx-1');
    expect(g.size).toBeGreaterThanOrEqual(Math.floor(VOCAB.length * 0.4));
    expect(g.size).toBeLessThanOrEqual(Math.ceil(VOCAB.length * 0.6));
  });
});

describe('AiWatermarkAdvanced.biasLogits (FR-R58.2)', () => {
  let wm: AiWatermarkAdvanced;
  beforeEach(() => {
    wm = new AiWatermarkAdvanced(CONFIG);
  });

  it('길이 불일치 거부', () => {
    expect(() => wm.biasLogits([1, 2, 3], 'ctx')).toThrow(
      'WM_LOGITS_LENGTH_MISMATCH',
    );
  });

  it('그린 토큰만 delta 가산', () => {
    const logits = new Array(VOCAB.length).fill(0);
    const biased = wm.biasLogits(logits, 'ctx-1');
    const green = wm.buildGreenList('ctx-1');
    for (let i = 0; i < VOCAB.length; i += 1) {
      const token = VOCAB[i];
      if (token !== undefined && green.has(token)) {
        expect(biased[i]).toBe(2.0);
      } else {
        expect(biased[i]).toBe(0);
      }
    }
  });
});

describe('AiWatermarkAdvanced.detect (FR-R58.3)', () => {
  let wm: AiWatermarkAdvanced;
  beforeEach(() => {
    wm = new AiWatermarkAdvanced(CONFIG);
  });

  it('전부 그린 토큰 → watermarked=true', () => {
    const green = [...wm.buildGreenList('ctx-1')];
    // 충분히 많은 토큰 반복
    const tokens = Array.from({ length: 200 }, (_, i) => green[i % green.length] ?? green[0]!);
    const res = wm.detect(tokens, 'ctx-1');
    expect(res.watermarked).toBe(true);
    expect(res.zScore).toBeGreaterThan(CONFIG.zThreshold);
  });

  it('랜덤 토큰 → watermarked=false 확률 높음', () => {
    const tokens = VOCAB.slice(); // 전체 vocab → ratio ≈ 0.5
    const res = wm.detect(tokens, 'ctx-1');
    expect(res.watermarked).toBe(false);
  });

  it('빈 토큰 안전 반환', () => {
    const res = wm.detect([], 'ctx-1');
    expect(res.tokens).toBe(0);
    expect(res.watermarked).toBe(false);
  });
});

describe('AiWatermarkAdvanced.sign / verifySignature (FR-R58.4)', () => {
  let wm: AiWatermarkAdvanced;
  beforeEach(() => {
    wm = new AiWatermarkAdvanced(CONFIG);
  });

  it('자기 서명은 검증 통과', () => {
    const sig = wm.sign('hello', 'meta1');
    expect(wm.verifySignature('hello', 'meta1', sig)).toBe(true);
  });

  it('텍스트 변조 시 실패', () => {
    const sig = wm.sign('hello', 'meta1');
    expect(wm.verifySignature('hello!', 'meta1', sig)).toBe(false);
  });

  it('메타 변조 시 실패', () => {
    const sig = wm.sign('hello', 'meta1');
    expect(wm.verifySignature('hello', 'meta2', sig)).toBe(false);
  });

  it('잘못된 시그니처 실패', () => {
    expect(wm.verifySignature('hello', 'meta', 'abc')).toBe(false);
  });
});

describe('AiWatermarkAdvanced.assessRobustness (FR-R58.5)', () => {
  it('동일 토큰이면 1에 가까움', () => {
    const wm = new AiWatermarkAdvanced(CONFIG);
    const green = [...wm.buildGreenList('ctx-1')];
    const tokens = Array.from({ length: 200 }, (_, i) => green[i % green.length] ?? green[0]!);
    const r = wm.assessRobustness(tokens, tokens, 'ctx-1');
    expect(r).toBeCloseTo(1, 1);
  });

  it('완전 다른 텍스트는 낮은 값', () => {
    const wm = new AiWatermarkAdvanced(CONFIG);
    const green = [...wm.buildGreenList('ctx-1')];
    const orig = Array.from({ length: 200 }, (_, i) => green[i % green.length] ?? green[0]!);
    // modified는 그린 리스트 외부만 사용
    const greenSet = wm.buildGreenList('ctx-1');
    const red = VOCAB.filter((t) => !greenSet.has(t));
    const mod = Array.from({ length: 200 }, (_, i) => red[i % red.length] ?? red[0]!);
    const r = wm.assessRobustness(orig, mod, 'ctx-1');
    expect(r).toBeLessThan(0.5);
  });
});

describe('AiWatermarkAdvanced.audit (FR-R58.6)', () => {
  it('주요 액션 기록', () => {
    const wm = new AiWatermarkAdvanced(CONFIG);
    wm.buildGreenList('ctx');
    wm.biasLogits(new Array(VOCAB.length).fill(0), 'ctx');
    wm.detect(['tok0', 'tok1'], 'ctx');
    const sig = wm.sign('t', 'm');
    wm.verifySignature('t', 'm', sig);
    const log = wm.getAuditLog();
    expect(log.some((e) => e.action === 'GREEN_LIST_BUILT')).toBe(true);
    expect(log.some((e) => e.action === 'LOGITS_BIASED')).toBe(true);
    expect(log.some((e) => e.action === 'DETECT')).toBe(true);
    expect(log.some((e) => e.action === 'SIGN')).toBe(true);
    expect(log.some((e) => e.action === 'VERIFY_SIGN')).toBe(true);
  });
});
