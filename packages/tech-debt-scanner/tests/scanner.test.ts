/**
 * 기술 부채 스캐너 테스트
 * Design Ref: MTU-N177
 */

import {
  analyzeComplexity,
  analyzeDependencies,
  analyzeCoverageGaps,
  calculateDebtScore,
  generateSummary,
  DebtPriority,
  DebtCategory,
} from '../src/scanner';

describe('Tech Debt Scanner', () => {
  describe('analyzeComplexity', () => {
    it('높은 복잡도 파일 감지', () => {
      const items = analyzeComplexity([
        { path: 'src/auth.ts', cyclomaticComplexity: 45, lines: 200 },
      ]);
      expect(items.length).toBe(1);
      expect(items[0].priority).toBe(DebtPriority.Critical);
    });

    it('대형 파일 감지 (800줄 초과)', () => {
      const items = analyzeComplexity([
        { path: 'src/utils.ts', cyclomaticComplexity: 5, lines: 1200 },
      ]);
      expect(items.length).toBe(1);
      expect(items[0].category).toBe(DebtCategory.CodeComplexity);
    });

    it('정상 파일은 부채 없음', () => {
      const items = analyzeComplexity([
        { path: 'src/simple.ts', cyclomaticComplexity: 5, lines: 100 },
      ]);
      expect(items.length).toBe(0);
    });
  });

  describe('analyzeDependencies', () => {
    it('EOL 의존성 Critical 분류', () => {
      const items = analyzeDependencies([
        { name: 'node', currentVersion: '16.0.0', latestVersion: '22.0.0', majorsBehind: 6, eol: true },
      ]);
      expect(items[0].priority).toBe(DebtPriority.Critical);
    });

    it('3+ 메이저 뒤처짐 High 분류', () => {
      const items = analyzeDependencies([
        { name: 'express', currentVersion: '3.0.0', latestVersion: '6.0.0', majorsBehind: 3, eol: false },
      ]);
      expect(items[0].priority).toBe(DebtPriority.High);
    });
  });

  describe('analyzeCoverageGaps', () => {
    it('30% 미만 커버리지 Critical', () => {
      const items = analyzeCoverageGaps([
        { name: 'auth', coverage: 25, criticalPaths: 10, coveredPaths: 3 },
      ]);
      expect(items[0].priority).toBe(DebtPriority.Critical);
    });

    it('80% 이상 커버리지는 부채 없음', () => {
      const items = analyzeCoverageGaps([
        { name: 'utils', coverage: 85, criticalPaths: 10, coveredPaths: 9 },
      ]);
      expect(items.length).toBe(0);
    });
  });

  describe('calculateDebtScore', () => {
    it('부채 없으면 100점', () => {
      expect(calculateDebtScore([])).toBe(100);
    });

    it('Critical 항목 1개 → 90점', () => {
      const items = analyzeComplexity([
        { path: 'src/complex.ts', cyclomaticComplexity: 50, lines: 200 },
      ]);
      const score = calculateDebtScore(items);
      expect(score).toBe(90);
    });
  });

  describe('generateSummary', () => {
    it('요약 생성 정상', () => {
      const items = [
        ...analyzeComplexity([
          { path: 'src/a.ts', cyclomaticComplexity: 30, lines: 200 },
        ]),
        ...analyzeDependencies([
          { name: 'pkg', currentVersion: '1.0', latestVersion: '4.0', majorsBehind: 3, eol: false },
        ]),
      ];
      const summary = generateSummary(items);
      expect(summary.totalItems).toBe(2);
      expect(summary.score).toBeLessThan(100);
    });

    it('트렌드 개선 감지', () => {
      const summary = generateSummary([], 80);
      expect(summary.trend).toBe('improving');
    });
  });
});
