// Design Ref: MTU-N480 §공급망 공격 모니터링
// Plan SC: FR-SC.1~5

export interface Dependency {
  name: string;
  version: string;
  source: string;
  publisher: string;
  updatedAt: string;
}

export interface DependencyNode {
  id: string;
  dep: Dependency;
  children: string[];
}

export interface TrustScore {
  name: string;
  score: number;
  factors: string[];
}

export interface SbomDiff {
  added: string[];
  removed: string[];
  upgraded: Array<{ name: string; from: string; to: string }>;
}

export interface QuarantinePolicy {
  name: string;
  reason: string;
  allowExec: boolean;
}

export class SupplyChainMonitor {
  private graph = new Map<string, DependencyNode>();
  private sbomHistory: Dependency[][] = [];

  /** FR-SC.1 의존성 그래프 */
  buildGraph(deps: Array<Dependency & { children?: string[] }>): void {
    for (const d of deps) {
      this.graph.set(d.name, { id: d.name, dep: d, children: d.children ?? [] });
    }
  }

  /** FR-SC.2 신뢰도 스코어 */
  scoreTrust(dep: Dependency): TrustScore {
    let score = 0.5;
    const factors: string[] = [];
    const trustedPublishers = new Set(['npmjs', 'GitHub', 'Microsoft', 'Apache']);
    if (trustedPublishers.has(dep.publisher)) {
      score += 0.3;
      factors.push('신뢰된 퍼블리셔');
    }
    const daysSinceUpdate = (Date.now() - new Date(dep.updatedAt).getTime()) / 86400000;
    if (daysSinceUpdate < 1) {
      score -= 0.2;
      factors.push('최근 업데이트 의심');
    } else if (daysSinceUpdate > 30) {
      score += 0.1;
      factors.push('안정화된 버전');
    }
    return { name: dep.name, score: +score.toFixed(3), factors };
  }

  /** FR-SC.3 이상 업데이트 탐지 */
  detectSuspiciousUpdate(dep: Dependency, previousPublisher: string): boolean {
    return dep.publisher !== previousPublisher;
  }

  /** FR-SC.4 SBOM 변화 추적 */
  trackSbom(current: Dependency[]): SbomDiff {
    const prev = this.sbomHistory[this.sbomHistory.length - 1] ?? [];
    this.sbomHistory.push(current);
    const prevMap = new Map(prev.map((d) => [d.name, d.version]));
    const curMap = new Map(current.map((d) => [d.name, d.version]));
    const added: string[] = [];
    const removed: string[] = [];
    const upgraded: Array<{ name: string; from: string; to: string }> = [];
    for (const [name, ver] of curMap) {
      if (!prevMap.has(name)) added.push(name);
      else if (prevMap.get(name) !== ver) upgraded.push({ name, from: prevMap.get(name)!, to: ver });
    }
    for (const [name] of prevMap) if (!curMap.has(name)) removed.push(name);
    return { added, removed, upgraded };
  }

  /** FR-SC.5 격리 정책 */
  quarantine(name: string, reason: string): QuarantinePolicy {
    return { name, reason, allowExec: false };
  }
}

export const supplyChainMonitor = new SupplyChainMonitor();
