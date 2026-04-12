/**
 * 알고리즘 투명성 보고서 + 설명 가능성
 * Design Ref: MTU-N464~N465 §3
 * Plan SC: FR-AT.1~5, FR-XAI.1~5
 */

export interface ModelCard {
  modelId: string;
  version: string;
  task: string;
  description: string;
  trainingData: {
    sources: string[];
    sampleCount: number;
    periodStart: string;
    periodEnd: string;
  };
  performance: {
    metric: string;
    value: number;
  }[];
  fairness: {
    group: string;
    disparate: number;
  }[];
  limitations: string[];
  createdAt: string;
}

/**
 * 모델 카드 생성기 (FR-AT.1~3)
 */
export class ModelCardBuilder {
  private card: Partial<ModelCard> = {};

  setBasic(modelId: string, version: string, task: string, description: string): this {
    this.card.modelId = modelId;
    this.card.version = version;
    this.card.task = task;
    this.card.description = description;
    return this;
  }

  setTrainingData(data: ModelCard['trainingData']): this {
    this.card.trainingData = { ...data, sources: [...data.sources] };
    return this;
  }

  addMetric(metric: string, value: number): this {
    if (!this.card.performance) this.card.performance = [];
    this.card.performance.push({ metric, value });
    return this;
  }

  addFairness(group: string, disparate: number): this {
    if (!this.card.fairness) this.card.fairness = [];
    this.card.fairness.push({ group, disparate });
    return this;
  }

  addLimitation(limit: string): this {
    if (!this.card.limitations) this.card.limitations = [];
    this.card.limitations.push(limit);
    return this;
  }

  build(): ModelCard {
    if (!this.card.modelId || !this.card.trainingData) {
      throw new Error('ModelCard: 필수 필드(모델ID/학습데이터) 누락');
    }
    return {
      modelId: this.card.modelId,
      version: this.card.version ?? '1.0.0',
      task: this.card.task ?? '',
      description: this.card.description ?? '',
      trainingData: this.card.trainingData,
      performance: this.card.performance ?? [],
      fairness: this.card.fairness ?? [],
      limitations: this.card.limitations ?? [],
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * 공정성 불균형 지표 (FR-AT.4)
 */
export class FairnessAnalyzer {
  /**
   * 그룹간 양성 예측률 비율 (Disparate Impact Ratio)
   * 0.8 ~ 1.25 범위 밖이면 불공정 의심
   */
  disparateImpact(groupPositiveRate: number, referencePositiveRate: number): number {
    if (referencePositiveRate === 0) return 0;
    return groupPositiveRate / referencePositiveRate;
  }

  isFair(ratio: number): boolean {
    return ratio >= 0.8 && ratio <= 1.25;
  }
}

/**
 * 투명성 보고서 Markdown 렌더러 (FR-AT.5)
 */
export class TransparencyReportRenderer {
  toMarkdown(card: ModelCard): string {
    const lines: string[] = [];
    lines.push(`# 알고리즘 투명성 보고서: ${card.modelId}`);
    lines.push('');
    lines.push(`- **버전**: ${card.version}`);
    lines.push(`- **과제**: ${card.task}`);
    lines.push(`- **생성일**: ${card.createdAt}`);
    lines.push('');
    lines.push('## 설명');
    lines.push(card.description);
    lines.push('');
    lines.push('## 학습 데이터');
    lines.push(`- 출처: ${card.trainingData.sources.join(', ')}`);
    lines.push(`- 샘플 수: ${card.trainingData.sampleCount.toLocaleString()}`);
    lines.push(`- 기간: ${card.trainingData.periodStart} ~ ${card.trainingData.periodEnd}`);
    lines.push('');
    lines.push('## 성능');
    for (const p of card.performance) {
      lines.push(`- ${p.metric}: ${p.value}`);
    }
    lines.push('');
    lines.push('## 공정성');
    for (const f of card.fairness) {
      lines.push(`- ${f.group}: Disparate Impact ${f.disparate.toFixed(3)}`);
    }
    lines.push('');
    lines.push('## 한계');
    for (const lim of card.limitations) {
      lines.push(`- ${lim}`);
    }
    return lines.join('\n');
  }
}

/**
 * 설명 가능성 리포트 (FR-XAI.1~5)
 */
export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface ExplanationReport {
  decisionId: string;
  subjectId: string;
  outcome: string;
  topFeatures: FeatureImportance[];
  naturalLanguage: string;
  appealUrl: string;
  createdAt: string;
}

export class ExplanationBuilder {
  build(input: {
    decisionId: string;
    subjectId: string;
    outcome: string;
    features: FeatureImportance[];
    appealUrl: string;
  }): ExplanationReport {
    const top = [...input.features]
      .sort((a, b) => Math.abs(b.importance) - Math.abs(a.importance))
      .slice(0, 5);

    const narrative = top
      .map((f) => {
        const direction = f.importance > 0 ? '긍정' : '부정';
        return `'${f.feature}' 항목이 결과에 ${direction}적으로 영향 (기여도 ${Math.abs(f.importance).toFixed(2)})`;
      })
      .join('; ');

    return {
      decisionId: input.decisionId,
      subjectId: input.subjectId,
      outcome: input.outcome,
      topFeatures: top,
      naturalLanguage: `결정 사유: ${narrative}. 이의가 있으시면 아래 링크를 통해 신청해 주십시오.`,
      appealUrl: input.appealUrl,
      createdAt: new Date().toISOString(),
    };
  }
}
