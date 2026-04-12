// Design Ref: MTU-N484 §EDA 최적화
// Plan SC: FR-ED.1~5

export interface EventSchema {
  topic: string;
  version: string;
  fields: Array<{ name: string; type: string }>;
}

export interface TopicStats {
  topic: string;
  rps: number;
  consumerLag: number;
  partitions: number;
}

export interface PartitionPlan {
  topic: string;
  currentPartitions: number;
  recommendedPartitions: number;
  reason: string;
}

export interface DlqRoute {
  topic: string;
  dlqTopic: string;
  condition: string;
}

export class EventDrivenOptimizer {
  private schemas = new Map<string, EventSchema>();

  /** FR-ED.1 스키마 레지스트리 */
  registerSchema(schema: EventSchema): void {
    this.schemas.set(`${schema.topic}:${schema.version}`, schema);
  }

  getSchema(topic: string, version: string): EventSchema | undefined {
    return this.schemas.get(`${topic}:${version}`);
  }

  /** FR-ED.2 토픽 병합 추천 */
  recommendMerge(stats: TopicStats[]): Array<{ topics: string[]; reason: string }> {
    const lowRps = stats.filter((s) => s.rps < 10);
    if (lowRps.length < 2) return [];
    return [{ topics: lowRps.map((s) => s.topic), reason: '저부하 토픽 통합 (RPS<10)' }];
  }

  /** FR-ED.3 파티션 자동 조정 */
  recommendPartitions(stats: TopicStats): PartitionPlan {
    let recommended = stats.partitions;
    let reason = '변경 없음';
    if (stats.rps > 5000 && stats.partitions < 10) {
      recommended = Math.min(20, stats.partitions * 2);
      reason = '고부하 (RPS>5000)';
    } else if (stats.consumerLag > 10000) {
      recommended = stats.partitions + 2;
      reason = '컨슈머 랙 과다';
    }
    return { topic: stats.topic, currentPartitions: stats.partitions, recommendedPartitions: recommended, reason };
  }

  /** FR-ED.4 랙 예측 (단순 선형) */
  forecastLag(historicalLag: number[], steps: number): number[] {
    const n = historicalLag.length;
    if (n < 2) return new Array(steps).fill(historicalLag[n - 1] ?? 0);
    const last = historicalLag[n - 1] ?? 0;
    const first = historicalLag[0] ?? 0;
    const slope = (last - first) / (n - 1);
    const out: number[] = [];
    for (let i = 1; i <= steps; i++) {
      out.push(Math.max(0, Math.round(last + slope * i)));
    }
    return out;
  }

  /** FR-ED.5 DLQ 라우팅 */
  buildDlqRoute(topic: string): DlqRoute {
    return { topic, dlqTopic: `${topic}.dlq`, condition: 'retry_count > 3' };
  }
}

export const eventDrivenOptimizer = new EventDrivenOptimizer();
