import { describe, it, expect } from 'vitest';
import {
  RetrievalChunkDeduplicator,
  type RetrievalChunk,
} from '../retrieval-chunk-deduplicator.js';

function mk(
  id: string,
  text: string,
  score = 0.5,
  grade: 'O' | 'C' | 'S' = 'O',
): RetrievalChunk {
  return { id, text, source: 's', score, grade };
}

describe('exact dedup (FR-R77.1)', () => {
  it('정확 중복 제거', () => {
    const d = new RetrievalChunkDeduplicator();
    const res = d.dedup([
      mk('a', '민원 접수 방법 안내', 0.9),
      mk('b', '민원 접수 방법 안내', 0.5),
      mk('c', '주차 안내', 0.4),
    ]);
    expect(res.stats.exactDup).toBe(1);
    expect(res.stats.kept).toBe(2);
    const ids = res.kept.map((k) => k.id);
    expect(ids).toContain('a');
    expect(ids).toContain('c');
  });

  it('정규화 적용', () => {
    const d = new RetrievalChunkDeduplicator();
    const res = d.dedup([
      mk('a', '민원  접수.방법', 0.9),
      mk('b', '민원 접수 방법', 0.5),
    ]);
    expect(res.stats.exactDup).toBe(1);
  });
});

describe('semantic dedup (FR-R77.2)', () => {
  it('토큰 Jaccard 기반 의미 중복', () => {
    const d = new RetrievalChunkDeduplicator();
    const res = d.dedup(
      [
        mk('a', '민원 접수 방법 단계 안내', 0.9),
        mk('b', '민원 접수 방법 단계 설명', 0.7),
        mk('c', '주차 이용 안내', 0.6),
      ],
      { semanticThreshold: 0.6 },
    );
    // a,b 의미 중복으로 1개만 유지 기대
    expect(res.stats.semanticDup).toBeGreaterThanOrEqual(1);
    expect(res.kept.some((k) => k.id === 'c')).toBe(true);
  });

  it('threshold 0~1 범위 검증', () => {
    const d = new RetrievalChunkDeduplicator();
    expect(() => d.dedup([mk('a', 'x')], { semanticThreshold: 1.5 })).toThrow(
      'DEDUP_THRESHOLD_INVALID',
    );
  });
});

describe('대표 청크 선정 (FR-R77.3)', () => {
  it('score 높은 쪽 유지', () => {
    const d = new RetrievalChunkDeduplicator();
    const res = d.dedup([
      mk('low', '민원 접수 방법', 0.3),
      mk('high', '민원 접수 방법', 0.9),
    ]);
    expect(res.kept.length).toBe(1);
    expect(res.kept[0]?.id).toBe('high');
  });
});

describe('등급 차단 (FR-R77.4, N-05)', () => {
  it('C/S 등급 제거 + 통계', () => {
    const d = new RetrievalChunkDeduplicator();
    const res = d.dedup([
      mk('a', '공개 문서', 0.8, 'O'),
      mk('b', '비밀 문서', 0.9, 'C'),
      mk('c', '기밀 문서', 0.9, 'S'),
    ]);
    expect(res.stats.gradeBlocked).toBe(2);
    expect(res.kept.length).toBe(1);
    expect(res.kept[0]?.id).toBe('a');
  });
});

describe('감사 (FR-R77.5, D-06)', () => {
  it('DEDUP_EXACT 기록', () => {
    const d = new RetrievalChunkDeduplicator();
    d.dedup([mk('a', 'foo bar', 0.9), mk('b', 'foo bar', 0.5)]);
    expect(
      d.getAuditLog().some((e) => e.action === 'DEDUP_EXACT'),
    ).toBe(true);
  });

  it('BLOCKED 기록', () => {
    const d = new RetrievalChunkDeduplicator();
    d.dedup([mk('a', 'x', 0.5, 'S')]);
    expect(d.getAuditLog().some((e) => e.action === 'BLOCKED')).toBe(true);
  });

  it('STATS 항상 기록', () => {
    const d = new RetrievalChunkDeduplicator();
    d.dedup([mk('a', 'x')]);
    expect(d.getAuditLog().some((e) => e.action === 'STATS')).toBe(true);
  });
});

describe('경계 케이스', () => {
  it('빈 입력', () => {
    const d = new RetrievalChunkDeduplicator();
    const res = d.dedup([]);
    expect(res.stats.input).toBe(0);
    expect(res.kept.length).toBe(0);
  });

  it('단일 청크 그대로 유지', () => {
    const d = new RetrievalChunkDeduplicator();
    const res = d.dedup([mk('solo', '유일한 문서 내용')]);
    expect(res.kept.length).toBe(1);
  });
});
