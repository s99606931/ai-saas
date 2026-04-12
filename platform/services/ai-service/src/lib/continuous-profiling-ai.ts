// Design Ref: MTU-N434 §Continuous Profiling
// Plan SC: FR-N434.1~5

export interface StackSample {
  timestamp: number;
  stack: string[];
  weight: number;
}

export interface HotFunction {
  name: string;
  selfWeight: number;
  totalWeight: number;
  percent: number;
}

export interface ProfileDiff {
  function: string;
  baselineWeight: number;
  currentWeight: number;
  deltaPercent: number;
  regression: boolean;
}

export type AnomalyKind = 'lock-contention' | 'gc-storm' | 'memory-leak' | 'cpu-spike' | 'none';

export interface PerformanceRecommendation {
  kind: AnomalyKind;
  target: string;
  action: string;
  priority: 'low' | 'medium' | 'high';
}

export class ContinuousProfilingAi {
  /** FR-N434.1 스택 샘플 집계 */
  aggregate(samples: StackSample[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const s of samples) {
      for (const fn of s.stack) {
        map.set(fn, (map.get(fn) ?? 0) + s.weight);
      }
    }
    return map;
  }

  /** FR-N434.2 Hot function Top-N */
  topHotFunctions(samples: StackSample[], n: number): HotFunction[] {
    const agg = this.aggregate(samples);
    const totalWeight = Array.from(agg.values()).reduce<number>((a, b) => a + b, 0);
    const selfMap = new Map<string, number>();
    for (const s of samples) {
      const leaf = s.stack.at(-1);
      if (leaf) selfMap.set(leaf, (selfMap.get(leaf) ?? 0) + s.weight);
    }
    const list: HotFunction[] = Array.from(agg.entries()).map(([name, total]) => ({
      name,
      selfWeight: selfMap.get(name) ?? 0,
      totalWeight: total,
      percent: totalWeight === 0 ? 0 : +((total / totalWeight) * 100).toFixed(2),
    }));
    return list.sort((a, b) => b.totalWeight - a.totalWeight).slice(0, n);
  }

  /** FR-N434.3 버전 간 차분 */
  diff(baseline: StackSample[], current: StackSample[]): ProfileDiff[] {
    const b = this.aggregate(baseline);
    const c = this.aggregate(current);
    const keys = new Set<string>([...b.keys(), ...c.keys()]);
    const diffs: ProfileDiff[] = [];
    for (const k of keys) {
      const bw = b.get(k) ?? 0;
      const cw = c.get(k) ?? 0;
      const delta = bw === 0 ? (cw > 0 ? 100 : 0) : ((cw - bw) / bw) * 100;
      diffs.push({
        function: k,
        baselineWeight: bw,
        currentWeight: cw,
        deltaPercent: +delta.toFixed(2),
        regression: delta > 20,
      });
    }
    return diffs.sort((a, b) => b.deltaPercent - a.deltaPercent);
  }

  /** FR-N434.4 이상 패턴 분류 */
  classifyAnomaly(hot: HotFunction[]): AnomalyKind {
    const names = hot.map((h) => h.name.toLowerCase()).join(' ');
    if (names.includes('mutex') || names.includes('lock') || names.includes('sync')) return 'lock-contention';
    if (names.includes('gc') || names.includes('sweep') || names.includes('mark')) return 'gc-storm';
    if (names.includes('alloc') && hot.length > 0 && (hot[0]?.percent ?? 0) > 40) return 'memory-leak';
    if (hot.length > 0 && (hot[0]?.percent ?? 0) > 60) return 'cpu-spike';
    return 'none';
  }

  /** FR-N434.5 추천 */
  recommend(hot: HotFunction[]): PerformanceRecommendation[] {
    const kind = this.classifyAnomaly(hot);
    const target = hot[0]?.name ?? 'unknown';
    const rec: PerformanceRecommendation[] = [];
    switch (kind) {
      case 'lock-contention':
        rec.push({ kind, target, action: '락 범위 축소 또는 읽기-쓰기 락 분리', priority: 'high' });
        break;
      case 'gc-storm':
        rec.push({ kind, target, action: '할당 감소 — 객체 풀링 또는 버퍼 재사용', priority: 'high' });
        break;
      case 'memory-leak':
        rec.push({ kind, target, action: '참조 해제 누락 점검 또는 캐시 만료 정책 재설정', priority: 'high' });
        break;
      case 'cpu-spike':
        rec.push({ kind, target, action: 'Hot path 최적화 또는 캐싱 도입', priority: 'medium' });
        break;
      case 'none':
        rec.push({ kind, target, action: '정상 — 주기 모니터링 유지', priority: 'low' });
        break;
    }
    return rec;
  }
}

export const continuousProfilingAi = new ContinuousProfilingAi();
