import { describe, it, expect } from 'vitest';
import { PlatformRoadmapAdvisor, type TechDebtItem } from '../platform-roadmap-advisor';

describe('PlatformRoadmapAdvisor', () => {
  const svc = new PlatformRoadmapAdvisor();

  const items: TechDebtItem[] = [
    {
      id: 'T1',
      title: '레거시 모노리스 분해',
      category: 'infra',
      estimatedEffortDays: 30,
      currentPainLevel: 9,
      dependencies: [],
    },
    {
      id: 'T2',
      title: 'CVE 패치 자동화',
      category: 'security',
      estimatedEffortDays: 10,
      currentPainLevel: 8,
      dependencies: [],
    },
    {
      id: 'T3',
      title: '서비스 문서화',
      category: 'docs',
      estimatedEffortDays: 5,
      currentPainLevel: 5,
      dependencies: ['T1'],
    },
    {
      id: 'T4',
      title: '쿼리 성능 튜닝',
      category: 'performance',
      estimatedEffortDays: 15,
      currentPainLevel: 7,
      dependencies: [],
    },
  ];

  it('scores items', () => {
    const s1 = svc.scoreItem(items[0]!);
    const s2 = svc.scoreItem(items[1]!);
    expect(s1).toBeGreaterThan(0);
    expect(s2).toBeGreaterThan(0);
  });

  it('estimates impact by category', () => {
    const sec = svc.estimateImpact(items[1]!);
    expect(sec.qualityGain).toBeGreaterThan(0);
    const perf = svc.estimateImpact(items[3]!);
    expect(perf.costReduction).toBeGreaterThan(0);
  });

  it('topological sort respects dependencies', () => {
    const sorted = svc.topologicalSort(items);
    const t1Idx = sorted.findIndex((i) => i.id === 'T1');
    const t3Idx = sorted.findIndex((i) => i.id === 'T3');
    expect(t1Idx).toBeLessThan(t3Idx);
  });

  it('builds roadmap within effort budget', () => {
    const roadmap = svc.buildRoadmap(items, ['2026-Q2', '2026-Q3'], 40);
    expect(roadmap).toHaveLength(2);
    for (const q of roadmap) {
      expect(q.totalEffortDays).toBeLessThanOrEqual(40);
    }
  });

  it('generates report', () => {
    const roadmap = svc.buildRoadmap(items, ['2026-Q2'], 100);
    const report = svc.generateReport(roadmap, items);
    expect(report).toContain('플랫폼 로드맵');
    expect(report).toContain('2026-Q2');
  });
});
