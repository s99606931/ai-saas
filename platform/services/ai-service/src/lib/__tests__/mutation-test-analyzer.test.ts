// MTU-N376 뮤테이션 테스트 AI 분석기 테스트
import { describe, it, expect } from 'vitest';
import { MutationTestAnalyzerService, type MutationResult } from '../mutation-test-analyzer.js';

describe('MTU-N376 MutationTestAnalyzer', () => {
  const svc = new MutationTestAnalyzerService('tenant-n376');

  const source = `
    function add(a, b) {
      if (a >= 0 && b <= 10) return a + b;
      return 0;
    }
  `;

  it('FR-N376.1: 뮤테이션 생성', () => {
    const mutations = svc.generate(source, 'add.ts');
    expect(mutations.length).toBeGreaterThan(0);
  });

  it('FR-N376.2: 샘플링', () => {
    const mutations = svc.generate(source, 'add.ts');
    const sample = svc.sample(mutations, 2);
    expect(sample.length).toBeLessThanOrEqual(2);
  });

  it('FR-N376.3: 결과 분석', () => {
    const mutations = svc.generate(source, 'add.ts');
    const results: MutationResult[] = mutations.map((m, i) => ({ mutationId: m.mutationId, killed: i % 2 === 0 }));
    const report = svc.analyze(mutations, results);
    expect(report.total).toBe(mutations.length);
    expect(report.score).toBeGreaterThanOrEqual(0);
  });

  it('FR-N376.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
