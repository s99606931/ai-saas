// MTU-N376 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  generateMutations,
  sampleMutations,
  analyzeResults,
  getMutationAuditLog,
  MutationTestAnalyzerService,
  type Mutation,
} from '../../src/lib/mutation-test-analyzer';

describe('MTU-N376 MutationTestAnalyzer', () => {
  it('산술 연산자 뮤테이션', () => {
    const muts = generateMutations('a + b', 'f.ts');
    expect(muts.some((m) => m.operator === 'arithmetic_swap')).toBe(true);
  });

  it('비교 연산자 뮤테이션', () => {
    const muts = generateMutations('x === 1', 'f.ts');
    expect(muts.some((m) => m.operator === 'boolean_negate')).toBe(true);
  });

  it('>= 경계 뮤테이션', () => {
    const muts = generateMutations('x >= 0', 'f.ts');
    expect(muts.some((m) => m.operator === 'comparison_swap')).toBe(true);
  });

  it('return 제거 뮤테이션', () => {
    const muts = generateMutations('return 42;', 'f.ts');
    expect(muts.some((m) => m.operator === 'return_remove')).toBe(true);
  });

  it('뮤테이션 샘플링', () => {
    const muts: Mutation[] = Array.from({ length: 100 }, (_, i) => ({
      mutationId: `m-${i}`,
      operator: 'arithmetic_swap',
      location: `f.ts:${i}`,
      original: '+',
      mutated: '-',
    }));
    const sampled = sampleMutations(muts, 10);
    expect(sampled.length).toBe(10);
  });

  it('샘플 크기가 전체보다 크면 전체 반환', () => {
    const muts: Mutation[] = [{ mutationId: 'm-1', operator: 'arithmetic_swap', location: 'x', original: '+', mutated: '-' }];
    const sampled = sampleMutations(muts, 100);
    expect(sampled.length).toBe(1);
  });

  it('결과 분석 - 스코어 계산', () => {
    const muts: Mutation[] = [
      { mutationId: 'm-1', operator: 'arithmetic_swap', location: 'x', original: '+', mutated: '-' },
      { mutationId: 'm-2', operator: 'arithmetic_swap', location: 'y', original: '+', mutated: '-' },
    ];
    const results = [
      { mutationId: 'm-1', killed: true },
      { mutationId: 'm-2', killed: false },
    ];
    const report = analyzeResults('t1', muts, results);
    expect(report.score).toBe(0.5);
    expect(report.survived).toBe(1);
  });

  it('전체 생존 시 스코어 0', () => {
    const muts: Mutation[] = [{ mutationId: 'm-1', operator: 'arithmetic_swap', location: 'x', original: '+', mutated: '-' }];
    const report = analyzeResults('t1', muts, [{ mutationId: 'm-1', killed: false }]);
    expect(report.score).toBe(0);
  });

  it('빈 뮤테이션 처리', () => {
    const report = analyzeResults('t1', [], []);
    expect(report.score).toBe(0);
    expect(report.total).toBe(0);
  });

  it('서비스 클래스', () => {
    const svc = new MutationTestAnalyzerService('t2');
    const muts = svc.generate('a + b', 'f.ts');
    expect(muts.length).toBeGreaterThan(0);
  });

  it('감사 로그 기록', () => {
    analyzeResults('tenant-audit', [], []);
    expect(getMutationAuditLog('tenant-audit').length).toBeGreaterThan(0);
  });
});
