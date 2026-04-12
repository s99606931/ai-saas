import { describe, it, expect } from 'vitest';
import {
  DynamicFewShotSelector,
  type FewShotExample,
} from '../dynamic-few-shot-selector.js';

function mk(
  id: string,
  category: string,
  input: string,
  output: string,
): FewShotExample {
  return {
    id,
    category,
    input,
    output,
    tags: [],
    grade: 'O',
    createdAt: Date.now(),
  };
}

describe('register 등급 (FR-R75.1, N-05)', () => {
  it('O 등록', () => {
    const s = new DynamicFewShotSelector();
    s.register(mk('e1', 'faq', '안녕하세요 접수 방법', '접수 절차는...'));
    expect(s.size()).toBe(1);
  });
  it('C 차단', () => {
    const s = new DynamicFewShotSelector();
    const ex = mk('e1', 'faq', 'hi', 'hi');
    ex.grade = 'C';
    expect(() => s.register(ex)).toThrow('FEW_SHOT_GRADE_BLOCKED');
  });
  it('S 차단', () => {
    const s = new DynamicFewShotSelector();
    const ex = mk('e1', 'faq', 'hi', 'hi');
    ex.grade = 'S';
    expect(() => s.register(ex)).toThrow('FEW_SHOT_GRADE_BLOCKED');
  });
  it('유효성', () => {
    const s = new DynamicFewShotSelector();
    const ex = mk('', 'faq', 'hi', 'hi');
    expect(() => s.register(ex)).toThrow('FEW_SHOT_INVALID_EXAMPLE');
  });
  it('registerMany', () => {
    const s = new DynamicFewShotSelector();
    s.registerMany([mk('a', 'x', 'a text', 'o'), mk('b', 'x', 'b text', 'o')]);
    expect(s.size()).toBe(2);
  });
});

describe('select 기본 (FR-R75.2)', () => {
  it('유사도 정렬', () => {
    const s = new DynamicFewShotSelector();
    s.register(mk('a', 'faq', '민원 접수 방법 문의', 'x'));
    s.register(mk('b', 'faq', '운영시간 안내', 'x'));
    s.register(mk('c', 'faq', '주차 안내', 'x'));
    const res = s.select('민원 접수는 어떻게', { topK: 2, lambda: 1.0 });
    expect(res.length).toBe(2);
    expect(res[0]?.example.id).toBe('a');
  });
  it('topK 0 에러', () => {
    const s = new DynamicFewShotSelector();
    expect(() => s.select('q', { topK: 0, lambda: 0.5 })).toThrow(
      'FEW_SHOT_TOPK_INVALID',
    );
  });
  it('lambda 범위 에러', () => {
    const s = new DynamicFewShotSelector();
    expect(() => s.select('q', { topK: 2, lambda: 1.5 })).toThrow(
      'FEW_SHOT_LAMBDA_INVALID',
    );
  });
});

describe('select category 필터', () => {
  it('카테고리만 후보', () => {
    const s = new DynamicFewShotSelector();
    s.register(mk('a', 'faq', '민원 접수', 'x'));
    s.register(mk('b', 'complaint', '민원 불만', 'x'));
    const res = s.select('민원', {
      topK: 5,
      lambda: 0.8,
      categoryFilter: 'faq',
    });
    expect(res.length).toBe(1);
    expect(res[0]?.example.category).toBe('faq');
  });
});

describe('MMR 다양성 (FR-R75.3)', () => {
  it('lambda=0 이면 다양성 우선', () => {
    const s = new DynamicFewShotSelector();
    s.register(mk('a', 'x', '민원 접수 방법', 'o'));
    s.register(mk('b', 'x', '민원 접수 방법2', 'o'));
    s.register(mk('c', 'y', '전혀 다른 주차 문의', 'o'));
    const res = s.select('민원', { topK: 2, lambda: 0.0 });
    // lambda=0이면 첫 항목 후 가장 덜 유사한 것 선택
    expect(res.length).toBe(2);
    const ids = res.map((r) => r.example.id);
    expect(ids).toContain('c');
  });
  it('lambda=1 이면 순수 유사도', () => {
    const s = new DynamicFewShotSelector();
    s.register(mk('a', 'x', '민원 접수 방법', 'o'));
    s.register(mk('b', 'x', '민원 접수 절차', 'o'));
    s.register(mk('c', 'y', '주차 안내', 'o'));
    const res = s.select('민원 접수', { topK: 2, lambda: 1.0 });
    const ids = res.map((r) => r.example.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });
});

describe('distribution 편향 (FR-R75.4)', () => {
  it('편향 경고', () => {
    const s = new DynamicFewShotSelector();
    const dist = s.distribution([
      mk('a', 'faq', 'x', 'y'),
      mk('b', 'faq', 'x', 'y'),
      mk('c', 'faq', 'x', 'y'),
      mk('d', 'other', 'x', 'y'),
    ]);
    expect(dist.biasWarning).toBe(true);
    expect(dist.perCategory.faq).toBe(3);
  });
  it('균형잡힘', () => {
    const s = new DynamicFewShotSelector();
    const dist = s.distribution([
      mk('a', 'faq', 'x', 'y'),
      mk('b', 'other', 'x', 'y'),
    ]);
    expect(dist.biasWarning).toBe(false);
  });
  it('빈 입력', () => {
    const s = new DynamicFewShotSelector();
    const dist = s.distribution([]);
    expect(dist.total).toBe(0);
    expect(dist.biasWarning).toBe(false);
  });
});

describe('감사 (FR-R75.5, D-06)', () => {
  it('REGISTER/SELECT 기록', () => {
    const s = new DynamicFewShotSelector();
    s.register(mk('a', 'x', 'foo bar', 'o'));
    s.select('foo', { topK: 1, lambda: 0.8 });
    const log = s.getAuditLog();
    expect(log.some((e) => e.event === 'REGISTER')).toBe(true);
    expect(log.some((e) => e.event === 'SELECT')).toBe(true);
  });
  it('GRADE_BLOCK 기록', () => {
    const s = new DynamicFewShotSelector();
    const ex = mk('e', 'x', 'a', 'b');
    ex.grade = 'S';
    try {
      s.register(ex);
    } catch {
      /* expected */
    }
    expect(s.getAuditLog().some((e) => e.event === 'GRADE_BLOCK')).toBe(true);
  });
  it('BIAS_WARN 기록', () => {
    const s = new DynamicFewShotSelector();
    for (let i = 0; i < 5; i += 1) {
      s.register(mk(`a${i}`, 'faq', `민원 접수 방법 ${i}`, 'o'));
    }
    s.register(mk('z', 'other', '주차 안내', 'o'));
    s.select('민원 접수', { topK: 5, lambda: 1.0 });
    expect(s.getAuditLog().some((e) => e.event === 'BIAS_WARN')).toBe(true);
  });
});
