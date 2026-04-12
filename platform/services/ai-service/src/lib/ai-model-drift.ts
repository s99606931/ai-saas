// Design Ref: MTU-N421 §AI 모델 드리프트 감지
// Plan SC: FR-N421.1~5

export interface DataDistribution {
  featureName: string;
  bins: number[];
  counts: number[];
}

export interface DriftResult {
  featureName: string;
  psi: number;
  severity: 'none' | 'minor' | 'major';
}

export interface ConceptDriftResult {
  labelName: string;
  klDivergence: number;
  shifted: boolean;
}

export interface PerformanceWindow {
  windowId: string;
  accuracy: number;
  f1: number;
  timestamp: string;
}

export class AIModelDrift {
  /** FR-N421.1 분포 수집 */
  buildDistribution(feature: string, values: number[], numBins = 10): DataDistribution {
    if (values.length === 0) {
      return { featureName: feature, bins: [], counts: [] };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = (max - min) / numBins || 1;
    const bins = Array.from({ length: numBins + 1 }, (_, i) => +(min + i * step).toFixed(3));
    const counts = new Array(numBins).fill(0);
    for (const v of values) {
      let idx = Math.floor((v - min) / step);
      if (idx >= numBins) idx = numBins - 1;
      if (idx < 0) idx = 0;
      counts[idx]++;
    }
    return { featureName: feature, bins, counts };
  }

  /** FR-N421.2 PSI */
  calculatePSI(baseline: DataDistribution, current: DataDistribution): DriftResult {
    const totalB = baseline.counts.reduce((s, v) => s + v, 0) || 1;
    const totalC = current.counts.reduce((s, v) => s + v, 0) || 1;
    let psi = 0;
    const n = Math.min(baseline.counts.length, current.counts.length);
    for (let i = 0; i < n; i++) {
      const pb = Math.max(0.0001, (baseline.counts[i] ?? 0) / totalB);
      const pc = Math.max(0.0001, (current.counts[i] ?? 0) / totalC);
      psi += (pc - pb) * Math.log(pc / pb);
    }
    const severity: DriftResult['severity'] = psi < 0.1 ? 'none' : psi < 0.25 ? 'minor' : 'major';
    return { featureName: baseline.featureName, psi: +psi.toFixed(4), severity };
  }

  /** FR-N421.3 컨셉 드리프트 (KL 발산) */
  detectConceptDrift(
    labelName: string,
    baselineDist: Record<string, number>,
    currentDist: Record<string, number>,
  ): ConceptDriftResult {
    const allKeys = new Set([...Object.keys(baselineDist), ...Object.keys(currentDist)]);
    const totalB = Object.values(baselineDist).reduce((s, v) => s + v, 0) || 1;
    const totalC = Object.values(currentDist).reduce((s, v) => s + v, 0) || 1;
    let kl = 0;
    for (const k of allKeys) {
      const p = Math.max(0.0001, (baselineDist[k] ?? 0) / totalB);
      const q = Math.max(0.0001, (currentDist[k] ?? 0) / totalC);
      kl += p * Math.log(p / q);
    }
    return { labelName, klDivergence: +kl.toFixed(4), shifted: kl > 0.1 };
  }

  /** FR-N421.4 성능 저하 */
  detectPerformanceDegradation(windows: PerformanceWindow[], threshold = 0.05): {
    degraded: boolean;
    baselineAccuracy: number;
    currentAccuracy: number;
    drop: number;
  } {
    if (windows.length < 2) {
      return { degraded: false, baselineAccuracy: 0, currentAccuracy: 0, drop: 0 };
    }
    const half = Math.floor(windows.length / 2);
    const baseline = windows.slice(0, half);
    const current = windows.slice(half);
    const baseAcc = baseline.reduce((s, w) => s + w.accuracy, 0) / baseline.length;
    const curAcc = current.reduce((s, w) => s + w.accuracy, 0) / current.length;
    const drop = baseAcc - curAcc;
    return {
      degraded: drop > threshold,
      baselineAccuracy: +baseAcc.toFixed(3),
      currentAccuracy: +curAcc.toFixed(3),
      drop: +drop.toFixed(3),
    };
  }

  /** FR-N421.5 리트레이닝 트리거 */
  shouldRetrain(
    featureDrifts: DriftResult[],
    conceptDrifts: ConceptDriftResult[],
    performanceDegraded: boolean,
  ): { retrain: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const majorDrift = featureDrifts.filter((d) => d.severity === 'major');
    if (majorDrift.length > 0) reasons.push(`주요 feature 드리프트: ${majorDrift.map((d) => d.featureName).join(',')}`);
    if (conceptDrifts.some((d) => d.shifted)) reasons.push('컨셉 드리프트 감지');
    if (performanceDegraded) reasons.push('성능 저하');
    return { retrain: reasons.length > 0, reasons };
  }
}

export const aiModelDrift = new AIModelDrift();
