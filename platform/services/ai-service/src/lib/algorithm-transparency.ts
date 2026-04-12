// Design Ref: MTU-N464 §알고리즘 투명성
// Plan SC: FR-AT.1~5

export interface ModelCard {
  modelId: string;
  name: string;
  version: string;
  purpose: string;
  trainDatasets: Array<{ name: string; source: string; size: number }>;
  metrics: Record<string, number>;
  fairness?: Record<string, number>;
  knownLimitations: string[];
}

export interface DataDistribution {
  feature: string;
  distribution: Record<string, number>;
}

export interface FairnessReport {
  feature: string;
  biasScore: number;
  warning: boolean;
}

export class AlgorithmTransparency {
  private cards = new Map<string, ModelCard>();

  /** FR-AT.1 모델 카드 등록 */
  registerCard(card: ModelCard): void {
    this.cards.set(card.modelId, card);
  }

  getCard(modelId: string): ModelCard | undefined {
    return this.cards.get(modelId);
  }

  /** FR-AT.2 데이터 분포 계산 */
  computeDistribution(records: Array<Record<string, string | number>>, feature: string): DataDistribution {
    const dist: Record<string, number> = {};
    for (const r of records) {
      const v = String(r[feature] ?? 'unknown');
      dist[v] = (dist[v] ?? 0) + 1;
    }
    return { feature, distribution: dist };
  }

  /** FR-AT.3 성능 메트릭 요약 */
  summarizeMetrics(modelId: string): Record<string, number> | undefined {
    return this.cards.get(modelId)?.metrics;
  }

  /** FR-AT.4 공정성 지표 */
  evaluateFairness(groups: Record<string, number>): FairnessReport[] {
    const values = Object.values(groups);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const spread = max === 0 ? 0 : (max - min) / max;
    return Object.entries(groups).map(([feature, v]) => ({
      feature,
      biasScore: +(Math.abs(v - (max + min) / 2) / Math.max(max, 1)).toFixed(3),
      warning: spread > 0.2,
    }));
  }

  /** FR-AT.5 MD 리포트 */
  generateMarkdown(modelId: string): string {
    const c = this.cards.get(modelId);
    if (!c) return '';
    const lines: string[] = [];
    lines.push(`# 모델 카드: ${c.name} (${c.version})`);
    lines.push(`## 목적`);
    lines.push(c.purpose);
    lines.push(`## 학습 데이터`);
    for (const d of c.trainDatasets) lines.push(`- ${d.name} (${d.source}, ${d.size}건)`);
    lines.push(`## 성능`);
    for (const [k, v] of Object.entries(c.metrics)) lines.push(`- ${k}: ${v}`);
    lines.push(`## 알려진 한계`);
    for (const l of c.knownLimitations) lines.push(`- ${l}`);
    return lines.join('\n');
  }
}

export const algorithmTransparency = new AlgorithmTransparency();
