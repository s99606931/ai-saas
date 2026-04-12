// Design Ref: MTU-N430 §플랫폼 로드맵 추천
// Plan SC: FR-N430.1~5

export interface TechDebtItem {
  id: string;
  title: string;
  category: 'infra' | 'security' | 'quality' | 'performance' | 'docs';
  estimatedEffortDays: number;
  currentPainLevel: number;
  dependencies: string[];
}

export interface ImpactEstimate {
  itemId: string;
  costReduction: number;
  qualityGain: number;
  velocityGain: number;
  compositeScore: number;
}

export interface RoadmapQuarter {
  quarter: string;
  items: string[];
  totalEffortDays: number;
  expectedImpact: number;
}

export class PlatformRoadmapAdvisor {
  /** FR-N430.1 점수화 */
  scoreItem(item: TechDebtItem): number {
    const painWeight = item.currentPainLevel / 10;
    const effortWeight = 1 / Math.max(1, item.estimatedEffortDays / 5);
    return +(painWeight * 0.6 + effortWeight * 0.4).toFixed(3);
  }

  /** FR-N430.2 효과 예측 */
  estimateImpact(item: TechDebtItem): ImpactEstimate {
    const baseMul = item.currentPainLevel / 10;
    let cost = 0;
    let quality = 0;
    let velocity = 0;
    switch (item.category) {
      case 'infra':
        cost = 0.15 * baseMul;
        velocity = 0.1 * baseMul;
        break;
      case 'security':
        quality = 0.3 * baseMul;
        break;
      case 'quality':
        quality = 0.25 * baseMul;
        velocity = 0.1 * baseMul;
        break;
      case 'performance':
        cost = 0.1 * baseMul;
        quality = 0.15 * baseMul;
        break;
      case 'docs':
        velocity = 0.15 * baseMul;
        break;
    }
    const composite = +(cost * 0.3 + quality * 0.4 + velocity * 0.3).toFixed(3);
    return {
      itemId: item.id,
      costReduction: +cost.toFixed(3),
      qualityGain: +quality.toFixed(3),
      velocityGain: +velocity.toFixed(3),
      compositeScore: composite,
    };
  }

  /** FR-N430.3 의존성 기반 위상 정렬 */
  topologicalSort(items: TechDebtItem[]): TechDebtItem[] {
    const map = new Map(items.map((i) => [i.id, i]));
    const visited = new Set<string>();
    const result: TechDebtItem[] = [];

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const item = map.get(id);
      if (!item) return;
      for (const dep of item.dependencies) {
        if (map.has(dep)) visit(dep);
      }
      result.push(item);
    };

    for (const item of items) visit(item.id);
    return result;
  }

  /** FR-N430.4 분기별 로드맵 */
  buildRoadmap(
    items: TechDebtItem[],
    quartersToPlan: string[],
    daysPerQuarter = 60,
  ): RoadmapQuarter[] {
    const sorted = this.topologicalSort(items);
    const prioritized = sorted
      .map((i) => ({ item: i, score: this.scoreItem(i), impact: this.estimateImpact(i).compositeScore }))
      .sort((a, b) => b.score + b.impact - (a.score + a.impact));

    const quarters: RoadmapQuarter[] = quartersToPlan.map((q) => ({
      quarter: q,
      items: [],
      totalEffortDays: 0,
      expectedImpact: 0,
    }));

    const assigned = new Set<string>();
    for (const p of prioritized) {
      if (assigned.has(p.item.id)) continue;
      const depsDone = p.item.dependencies.every((d) => assigned.has(d));
      if (!depsDone) continue;
      const target = quarters.find((q) => q.totalEffortDays + p.item.estimatedEffortDays <= daysPerQuarter);
      if (!target) continue;
      target.items.push(p.item.id);
      target.totalEffortDays += p.item.estimatedEffortDays;
      target.expectedImpact = +(target.expectedImpact + p.impact).toFixed(3);
      assigned.add(p.item.id);
    }
    return quarters;
  }

  /** FR-N430.5 리포트 */
  generateReport(roadmap: RoadmapQuarter[], items: TechDebtItem[]): string {
    const map = new Map(items.map((i) => [i.id, i]));
    const lines: string[] = ['# 플랫폼 로드맵'];
    for (const q of roadmap) {
      lines.push(`\n## ${q.quarter}`);
      lines.push(`- 예상 공수: ${q.totalEffortDays}일`);
      lines.push(`- 예상 임팩트: ${q.expectedImpact}`);
      lines.push('### 항목');
      for (const id of q.items) {
        const item = map.get(id);
        if (item) lines.push(`- [${item.category}] ${item.title} (${item.estimatedEffortDays}일)`);
      }
    }
    return lines.join('\n');
  }
}

export const platformRoadmapAdvisor = new PlatformRoadmapAdvisor();
