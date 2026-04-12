// Design Ref: MTU-N479 §제로데이 탐지
// Plan SC: FR-0D.1~5

export interface BehaviorSample {
  entityId: string;
  metric: string;
  value: number;
  timestamp: string;
}

export interface Baseline {
  metric: string;
  mean: number;
  stddev: number;
}

export interface AnomalyEvent {
  entityId: string;
  metric: string;
  value: number;
  zScore: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  at: string;
}

export interface Incident {
  id: string;
  anomalies: AnomalyEvent[];
  status: 'open' | 'isolated' | 'closed';
  createdAt: string;
}

export class ZerodayDetector {
  private baselines = new Map<string, Baseline>();
  private incidents: Incident[] = [];
  private isolatedEntities = new Set<string>();

  /** FR-0D.1 베이스라인 학습 */
  learnBaseline(samples: BehaviorSample[]): Baseline[] {
    const byMetric = new Map<string, number[]>();
    for (const s of samples) {
      if (!byMetric.has(s.metric)) byMetric.set(s.metric, []);
      byMetric.get(s.metric)!.push(s.value);
    }
    const out: Baseline[] = [];
    for (const [metric, values] of byMetric) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
      const baseline = { metric, mean: +mean.toFixed(3), stddev: +Math.sqrt(variance).toFixed(3) };
      this.baselines.set(metric, baseline);
      out.push(baseline);
    }
    return out;
  }

  /** FR-0D.2 패턴 없는 이상 탐지 (Z-score) */
  detect(sample: BehaviorSample): AnomalyEvent | undefined {
    const b = this.baselines.get(sample.metric);
    if (!b || b.stddev === 0) return undefined;
    const z = Math.abs((sample.value - b.mean) / b.stddev);
    if (z < 3) return undefined;
    return {
      entityId: sample.entityId,
      metric: sample.metric,
      value: sample.value,
      zScore: +z.toFixed(2),
      severity: this.classify(z),
      at: sample.timestamp,
    };
  }

  /** FR-0D.3 심각도 분류 */
  private classify(z: number): AnomalyEvent['severity'] {
    if (z >= 8) return 'critical';
    if (z >= 6) return 'high';
    if (z >= 4) return 'medium';
    return 'low';
  }

  /** FR-0D.4 자동 격리 */
  isolate(entityId: string): void {
    this.isolatedEntities.add(entityId);
  }

  isIsolated(entityId: string): boolean {
    return this.isolatedEntities.has(entityId);
  }

  /** FR-0D.5 인시던트 등록 */
  createIncident(anomalies: AnomalyEvent[]): Incident {
    const incident: Incident = {
      id: `inc-${Date.now()}-${this.incidents.length + 1}`,
      anomalies,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.incidents.push(incident);
    if (anomalies.some((a) => a.severity === 'critical' || a.severity === 'high')) {
      for (const a of anomalies) this.isolate(a.entityId);
      incident.status = 'isolated';
    }
    return incident;
  }

  getIncidents(): Incident[] {
    return [...this.incidents];
  }
}

export const zerodayDetector = new ZerodayDetector();
