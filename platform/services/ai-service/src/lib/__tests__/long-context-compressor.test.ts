import { describe, it, expect, beforeEach } from 'vitest';
import { LongContextCompressor } from '../long-context-compressor.js';

describe('LongContextCompressor.compress (FR-R51.1)', () => {
  let comp: LongContextCompressor;

  beforeEach(() => {
    comp = new LongContextCompressor();
  });

  it('빈 텍스트는 빈 결과', () => {
    const r = comp.compress({ text: '' });
    expect(r.originalTokens).toBe(0);
    expect(r.compressedTokens).toBe(0);
  });

  it('30% 비율 압축', () => {
    const text = '공공기관 정보보호 정책 수립 및 시행 가이드 매뉴얼 종합 지원 시스템 통합 관리'.repeat(5);
    const r = comp.compress({ text, targetRatio: 0.3 });
    expect(r.compressedTokens).toBeLessThan(r.originalTokens);
    expect(r.compressionRatio).toBeLessThanOrEqual(0.5);
    expect(r.compressionRatio).toBeGreaterThan(0);
  });

  it('preserveFirstLast 옵션 동작', () => {
    const tokens = Array.from({ length: 100 }, (_v, i) => `word${i}`);
    const text = tokens.join(' ');
    const r = comp.compress({ text, targetRatio: 0.1, preserveFirstLast: true });
    const compressedTokens = r.compressed.split(/\s+/);
    expect(compressedTokens[0]).toBe('word0');
    expect(compressedTokens[compressedTokens.length - 1]).toBe('word99');
  });

  it('targetRatio clamp (1 이상은 0.99)', () => {
    const r = comp.compress({ text: 'a b c d e f g h i j', targetRatio: 5 });
    // 0.99로 clamp되므로 최소 1개 토큰은 제외 가능 (preserveFirstLast가 +2 보정해도 0.99*10=9.9 → 9)
    expect(r.compressionRatio).toBeLessThanOrEqual(1);
    expect(r.compressedTokens).toBeGreaterThan(0);
  });

  it('targetRatio 0 이하는 0.1로 처리', () => {
    const tokens = Array.from({ length: 100 }, (_v, i) => `t${i}`);
    const r = comp.compress({ text: tokens.join(' '), targetRatio: -1 });
    expect(r.compressedTokens).toBeGreaterThan(0);
    expect(r.compressedTokens).toBeLessThanOrEqual(20);
  });
});

describe('LongContextCompressor N2SF', () => {
  const comp = new LongContextCompressor();

  it('C등급 차단', () => {
    expect(() => comp.compress({ text: 'foo', dataGrade: 'C' })).toThrow('COMPRESS_DATA_GRADE_BLOCKED');
  });

  it('S등급 차단', () => {
    expect(() => comp.compress({ text: 'foo', dataGrade: 'S' })).toThrow('COMPRESS_DATA_GRADE_BLOCKED');
  });
});

describe('LongContextCompressor.compressChunks (FR-R51.2)', () => {
  it('짧은 텍스트는 일반 compress 위임', () => {
    const comp = new LongContextCompressor();
    const r = comp.compressChunks({ text: 'a b c d e' }, 100);
    expect(r.originalTokens).toBe(5);
  });

  it('긴 텍스트는 청크 단위 처리', () => {
    const comp = new LongContextCompressor();
    const tokens = Array.from({ length: 1500 }, (_v, i) => `tok${i}`);
    const r = comp.compressChunks({ text: tokens.join(' '), targetRatio: 0.3 }, 500);
    expect(r.originalTokens).toBe(1500);
    expect(r.compressedTokens).toBeLessThan(1500);
    expect(r.compressedTokens).toBeGreaterThan(0);
  });
});

describe('LongContextCompressor.scoreTokens (FR-R51.3)', () => {
  const comp = new LongContextCompressor();

  it('stopword는 낮은 점수', () => {
    const scores = comp.scoreTokens(['the', 'public', 'system']);
    expect(scores[0]).toBeLessThan(scores[1] ?? 0);
    expect(scores[0]).toBeLessThan(scores[2] ?? 0);
  });

  it('숫자 포함 토큰은 보너스', () => {
    const scores = comp.scoreTokens(['report', 'item-2026']);
    // 둘 다 7~9글자, 숫자 포함이 +0.2
    expect(scores[1]).toBeGreaterThan(scores[0] ?? 0);
  });

  it('첫 토큰은 위치 보너스', () => {
    const arr = Array.from({ length: 50 }, (_v, _i) => 'word');
    const scores = comp.scoreTokens(arr);
    expect(scores[0]).toBeGreaterThan(scores[25] ?? 0);
  });

  it('마지막 토큰도 위치 보너스', () => {
    const arr = Array.from({ length: 50 }, (_v, _i) => 'word');
    const scores = comp.scoreTokens(arr);
    expect(scores[49]).toBeGreaterThan(scores[25] ?? 0);
  });

  it('빈 배열은 빈 점수', () => {
    expect(comp.scoreTokens([])).toEqual([]);
  });
});

describe('LongContextCompressor.compressToRatio (FR-R51.4)', () => {
  it('정확한 비율로 압축', () => {
    const comp = new LongContextCompressor();
    const tokens = Array.from({ length: 100 }, (_v, i) => `t${i}`);
    const r = comp.compressToRatio(tokens.join(' '), 0.2);
    expect(r.compressedTokens).toBeLessThanOrEqual(20);
  });
});

describe('LongContextCompressor.stats (FR-R51.5)', () => {
  it('초기 통계 0', () => {
    const comp = new LongContextCompressor();
    const s = comp.stats();
    expect(s.totalCompressions).toBe(0);
    expect(s.avgRatio).toBe(0);
  });

  it('압축 후 통계 갱신', () => {
    const comp = new LongContextCompressor();
    comp.compress({ text: 'a b c d e f g h i j', targetRatio: 0.5 });
    comp.compress({ text: 'x y z w v', targetRatio: 0.5 });
    const s = comp.stats();
    expect(s.totalCompressions).toBe(2);
    expect(s.totalOriginalTokens).toBe(15);
    expect(s.avgRatio).toBeGreaterThan(0);
  });
});

describe('LongContextCompressor.audit (FR-R51.6)', () => {
  it('compress 호출 시 COMPRESS 액션 기록', () => {
    const comp = new LongContextCompressor();
    comp.compress({ text: 'a b c d e' });
    const log = comp.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.action).toBe('COMPRESS');
  });

  it('compressChunks 호출 시 COMPRESS_CHUNKS 액션 기록', () => {
    const comp = new LongContextCompressor();
    const tokens = Array.from({ length: 1500 }, (_v, i) => `t${i}`);
    comp.compressChunks({ text: tokens.join(' ') }, 500);
    const log = comp.getAuditLog();
    expect(log.some((e) => e.action === 'COMPRESS_CHUNKS')).toBe(true);
  });
});
