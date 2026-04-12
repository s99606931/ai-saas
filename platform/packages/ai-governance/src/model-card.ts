// Design Ref: MTU-N464 §model-card
// Plan SC: FR-AT.1 ~ FR-AT.5
//
// 알고리즘 투명성 — Google "Model Cards" 기반 메타데이터 + 공정성 지표.

export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  purpose: string;
  developer: string;
  trainedAt: string;
  license: string;
}

export interface TrainingData {
  sources: string[];
  sampleCount: number;
  distribution: Record<string, number>; // 예: { 'gender.female': 0.48, 'gender.male': 0.52 }
  collectionPeriod: string;
  preprocessing: string[];
}

export interface PerformanceMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  auc?: number;
  notes?: string;
}

export interface FairnessMetrics {
  // 인구 집단별 정확도 차이 (0~1, 작을수록 공정)
  groupDisparity: Record<string, number>;
  // Demographic Parity Difference |P(Ŷ=1|A=0) - P(Ŷ=1|A=1)|
  demographicParityDiff?: number;
  equalOpportunityDiff?: number;
  flaggedGroups: string[];
}

export interface ModelCard {
  metadata: ModelMetadata;
  trainingData: TrainingData;
  performance: PerformanceMetrics;
  fairness: FairnessMetrics;
  limitations: string[];
  ethicalConsiderations: string[];
}

// FR-AT.4: 공정성 지표 계산
export function computeFairness(
  groupAccuracy: Record<string, number>,
  positiveRates: Record<string, number>,
  threshold: number = 0.1,
): FairnessMetrics {
  const disparity: Record<string, number> = {};
  const values = Object.values(groupAccuracy);
  if (values.length === 0) {
    return {
      groupDisparity: {},
      flaggedGroups: [],
    };
  }
  const max = Math.max(...values);
  const flagged: string[] = [];
  for (const [g, acc] of Object.entries(groupAccuracy)) {
    const d = round4(max - acc);
    disparity[g] = d;
    if (d > threshold) flagged.push(g);
  }
  // Demographic Parity Difference
  let dpd: number | undefined;
  const rates = Object.values(positiveRates);
  if (rates.length >= 2) {
    dpd = round4(Math.max(...rates) - Math.min(...rates));
  }
  return {
    groupDisparity: disparity,
    demographicParityDiff: dpd,
    flaggedGroups: flagged,
  };
}

// FR-AT.1 ~ FR-AT.5: 모델 카드 빌더 + 보고서
export class ModelCardBuilder {
  build(params: {
    metadata: ModelMetadata;
    trainingData: TrainingData;
    performance: PerformanceMetrics;
    fairness: FairnessMetrics;
    limitations?: string[];
    ethicalConsiderations?: string[];
  }): ModelCard {
    return {
      metadata: params.metadata,
      trainingData: params.trainingData,
      performance: params.performance,
      fairness: params.fairness,
      limitations: params.limitations ?? [],
      ethicalConsiderations: params.ethicalConsiderations ?? [],
    };
  }

  renderMarkdown(card: ModelCard): string {
    const lines: string[] = [];
    lines.push(`# Model Card — ${card.metadata.name} v${card.metadata.version}`);
    lines.push(`- ID: ${card.metadata.id}`);
    lines.push(`- Developer: ${card.metadata.developer}`);
    lines.push(`- Trained: ${card.metadata.trainedAt}`);
    lines.push(`- License: ${card.metadata.license}`);
    lines.push('');
    lines.push('## 학습 데이터');
    lines.push(`- Sources: ${card.trainingData.sources.join(', ')}`);
    lines.push(`- Sample count: ${card.trainingData.sampleCount}`);
    lines.push(`- Collection: ${card.trainingData.collectionPeriod}`);
    lines.push('');
    lines.push('## 성능');
    for (const [k, v] of Object.entries(card.performance)) {
      if (typeof v === 'number') lines.push(`- ${k}: ${v}`);
    }
    lines.push('');
    lines.push('## 공정성');
    if (card.fairness.demographicParityDiff !== undefined) {
      lines.push(`- Demographic Parity Diff: ${card.fairness.demographicParityDiff}`);
    }
    if (card.fairness.flaggedGroups.length > 0) {
      lines.push(`- 플래그된 집단: ${card.fairness.flaggedGroups.join(', ')}`);
    }
    lines.push('');
    lines.push('## 한계');
    for (const l of card.limitations) lines.push(`- ${l}`);
    lines.push('');
    lines.push('## 윤리적 고려사항');
    for (const e of card.ethicalConsiderations) lines.push(`- ${e}`);
    return lines.join('\n');
  }
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
