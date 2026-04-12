import { describe, it, expect } from 'vitest';
import {
  ContextualMemoryManager,
  type MemoryKey,
} from '../contextual-memory-manager.js';

const K: MemoryKey = { agentId: 'chatbot', userId: 'u1', tenantId: 't1' };

describe('put 등급 검증 (FR-R74.1, N-05)', () => {
  it('O 등급 허용', () => {
    const m = new ContextualMemoryManager();
    const e = m.put(K, 'hi', { grade: 'O' });
    expect(e.content).toBe('hi');
  });
  it('C 등급 차단', () => {
    const m = new ContextualMemoryManager();
    expect(() => m.put(K, 'x', { grade: 'C' })).toThrow('MEMORY_GRADE_BLOCKED');
  });
  it('S 등급 차단', () => {
    const m = new ContextualMemoryManager();
    expect(() => m.put(K, 'x', { grade: 'S' })).toThrow('MEMORY_GRADE_BLOCKED');
  });
  it('잘못된 키', () => {
    const m = new ContextualMemoryManager();
    expect(() =>
      m.put({ agentId: '', userId: 'u1', tenantId: 't1' }, 'x'),
    ).toThrow('MEMORY_KEY_INVALID');
  });
  it('priority 범위 검증', () => {
    const m = new ContextualMemoryManager();
    expect(() => m.put(K, 'x', { priority: 0 })).toThrow(
      'MEMORY_PRIORITY_OUT_OF_RANGE',
    );
    expect(() => m.put(K, 'x', { priority: 11 })).toThrow(
      'MEMORY_PRIORITY_OUT_OF_RANGE',
    );
  });
});

describe('get 조회 (FR-R74.4)', () => {
  it('슬롯 필터', () => {
    const m = new ContextualMemoryManager();
    m.put(K, 'a', { slot: 'short-term' });
    m.put(K, 'b', { slot: 'long-term' });
    const res = m.get(K, { slot: 'short-term' });
    expect(res.length).toBe(1);
    expect(res[0]?.content).toBe('a');
  });
  it('우선순위 정렬', () => {
    const m = new ContextualMemoryManager();
    m.put(K, 'low', { priority: 2 });
    m.put(K, 'high', { priority: 9 });
    const res = m.get(K);
    expect(res[0]?.content).toBe('high');
  });
  it('다른 키 격리', () => {
    const m = new ContextualMemoryManager();
    m.put(K, 'mine');
    m.put({ agentId: 'chatbot', userId: 'u2', tenantId: 't1' }, 'other');
    const res = m.get(K);
    expect(res.length).toBe(1);
    expect(res[0]?.content).toBe('mine');
  });
  it('limit 적용', () => {
    const m = new ContextualMemoryManager();
    for (let i = 0; i < 5; i += 1) m.put(K, `c${i}`);
    const res = m.get(K, { limit: 2 });
    expect(res.length).toBe(2);
  });
});

describe('TTL + eviction (FR-R74.2)', () => {
  it('만료된 엔트리 제외', () => {
    const m = new ContextualMemoryManager();
    m.put(K, 'old', { ttlMs: 1 });
    // 약간 기다려야 하지만 sweep 호출로 강제 테스트
    const futureNow = Date.now() + 10;
    m.sweep(futureNow);
    const res = m.get(K);
    expect(res.length).toBe(0);
  });
  it('perSlotMax 초과 시 우선순위 낮은 것 eviction', () => {
    const m = new ContextualMemoryManager({ perSlotMax: 2 });
    m.put(K, 'a', { priority: 1 });
    m.put(K, 'b', { priority: 5 });
    m.put(K, 'c', { priority: 9 });
    const res = m.get(K);
    expect(res.length).toBe(2);
    expect(res.map((e) => e.content)).not.toContain('a');
  });
  it('maxTotal 초과 시 eviction', () => {
    const m = new ContextualMemoryManager({ maxTotal: 3 });
    for (let i = 0; i < 5; i += 1) {
      m.put(
        {
          agentId: `a${i}`,
          userId: `u${i}`,
          tenantId: 't1',
        },
        `v${i}`,
        { priority: i + 1 },
      );
    }
    expect(m.stats().total).toBe(3);
  });
});

describe('summarize (FR-R74.3)', () => {
  it('top K 요약 저장', () => {
    const m = new ContextualMemoryManager();
    m.put(K, 'fact1');
    m.put(K, 'fact2');
    m.put(K, 'fact3');
    const s = m.summarize(K, 3);
    expect(s.sourceIds.length).toBe(3);
    const summaries = m.get(K, { slot: 'summary' });
    expect(summaries.length).toBeGreaterThan(0);
  });
});

describe('sweep + stats (FR-R74.5)', () => {
  it('sweep 반환값', () => {
    const m = new ContextualMemoryManager();
    m.put(K, 'x', { ttlMs: 1 });
    const removed = m.sweep(Date.now() + 1000);
    expect(removed).toBeGreaterThanOrEqual(0);
  });
  it('stats 구조', () => {
    const m = new ContextualMemoryManager();
    m.put(K, 'a', { slot: 'short-term' });
    m.put(K, 'b', { slot: 'long-term' });
    const s = m.stats();
    expect(s.total).toBe(2);
    expect(s.perGrade.O).toBe(2);
    expect(s.perSlot['short-term']).toBe(1);
  });
});

describe('감사 로그 (FR-R74.5, D-06)', () => {
  it('PUT/GET 기록', () => {
    const m = new ContextualMemoryManager();
    m.put(K, 'x');
    m.get(K);
    const log = m.getAuditLog();
    expect(log.some((e) => e.event === 'PUT')).toBe(true);
    expect(log.some((e) => e.event === 'GET')).toBe(true);
  });
  it('GRADE_BLOCK 기록', () => {
    const m = new ContextualMemoryManager();
    try {
      m.put(K, 'x', { grade: 'S' });
    } catch {
      /* expected */
    }
    expect(m.getAuditLog().some((e) => e.event === 'GRADE_BLOCK')).toBe(true);
  });
});
