// 민원 만족도 예측 AI — FR-N398.1~5

export type ComplaintChannel = 'online' | 'phone' | 'visit' | 'mail';
export type ComplaintCategory = 'tax' | 'welfare' | 'permit' | 'sanitation' | 'etc';

export interface ComplaintFeatures {
  id: string;
  category: ComplaintCategory;
  channel: ComplaintChannel;
  responseHours: number;
  reassignmentCount: number;
  priorContactCount: number;
  textLength: number;
  sentimentScore: number; // -1..1
}

export interface SatisfactionPrediction {
  id: string;
  probability: number; // 0..1
  level: 'low' | 'medium' | 'high';
  riskFlag: boolean;
  recommendations: string[];
}

export interface FeedbackSample {
  id: string;
  features: ComplaintFeatures;
  actualSatisfaction: number; // 0..1
}

export class CivilSatisfactionPredictor {
  private weights = {
    responseHours: -0.02,
    reassignment: -0.08,
    priorContact: -0.05,
    sentiment: 0.35,
    textLength: -0.001,
    bias: 0.75,
  };

  predict(features: ComplaintFeatures): SatisfactionPrediction {
    const raw =
      this.weights.bias +
      this.weights.responseHours * features.responseHours +
      this.weights.reassignment * features.reassignmentCount +
      this.weights.priorContact * features.priorContactCount +
      this.weights.sentiment * features.sentimentScore +
      this.weights.textLength * features.textLength;
    const probability = Math.max(0, Math.min(1, raw));
    const level: SatisfactionPrediction['level'] =
      probability >= 0.7 ? 'high' : probability >= 0.4 ? 'medium' : 'low';
    return {
      id: features.id,
      probability: Number(probability.toFixed(3)),
      level,
      riskFlag: probability < 0.4,
      recommendations: this.recommend(features, probability),
    };
  }

  batchPredict(list: ComplaintFeatures[]): SatisfactionPrediction[] {
    return list.map((f) => this.predict(f));
  }

  updateFromFeedback(samples: FeedbackSample[]): void {
    if (samples.length === 0) throw new Error('FEEDBACK_EMPTY');
    let error = 0;
    for (const s of samples) {
      const pred = this.predict(s.features);
      error += s.actualSatisfaction - pred.probability;
    }
    const avgError = error / samples.length;
    this.weights.bias += avgError * 0.1;
  }

  private recommend(f: ComplaintFeatures, prob: number): string[] {
    const recs: string[] = [];
    if (f.responseHours > 48) recs.push('24시간 이내 1차 응답 필요');
    if (f.reassignmentCount >= 2) recs.push('전담 부서 지정 필요');
    if (f.sentimentScore < -0.3) recs.push('관리자 직접 개입 권장');
    if (prob < 0.4) recs.push('고위험 민원 — 우선 처리');
    return recs;
  }
}
