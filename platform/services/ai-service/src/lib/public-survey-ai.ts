// Design Ref: MTU-N411 §공공 전자설문 AI
// Plan SC: FR-N411.1~5
// CSAP: D-06 감사 로그 / N2SF O등급 (마스킹 후 분석)

export type SurveyQuestionType = 'likert5' | 'single' | 'multi' | 'freetext';

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  options?: string[];
  required: boolean;
}

export interface SurveyDraft {
  surveyId: string;
  title: string;
  purpose: string;
  targetAudience: string;
  questions: SurveyQuestion[];
  estimatedMinutes: number;
}

export interface SurveyResponse {
  responseId: string;
  surveyId: string;
  respondentHash: string;
  answers: Record<string, string | number | string[]>;
  submittedAt: string;
  ipHash?: string;
}

export interface SurveyAggregation {
  surveyId: string;
  totalResponses: number;
  completionRate: number;
  perQuestion: Array<{
    questionId: string;
    distribution: Record<string, number>;
    mean?: number;
  }>;
}

export interface FreetextInsight {
  questionId: string;
  topTopics: Array<{ topic: string; count: number; sentiment: number }>;
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  sampleQuotes: string[];
}

export interface BiasFinding {
  responseId: string;
  reasons: string[];
  severity: 'low' | 'med' | 'high';
}

export class PublicSurveyAI {
  /** FR-N411.1: 목적으로부터 문항 자동 생성 */
  generateQuestions(input: {
    purpose: string;
    audience: string;
    maxQuestions?: number;
  }): SurveyDraft {
    const max = input.maxQuestions ?? 10;
    const stem = input.purpose.trim();
    if (!stem) throw new Error('purpose is required');

    const questions: SurveyQuestion[] = [];
    const templates: Array<[SurveyQuestionType, string]> = [
      ['likert5', `${stem}에 대한 전반적 만족도는 어떻습니까?`],
      ['likert5', `${stem} 서비스의 접근성은 어떻습니까?`],
      ['likert5', `${stem} 관련 정보 전달이 충분합니까?`],
      ['single', `${stem} 이용 빈도는?`],
      ['multi', `${stem}에서 개선이 필요한 영역을 모두 고르세요.`],
      ['freetext', `${stem}에 대한 개선 의견을 자유롭게 작성해 주세요.`],
    ];
    for (let i = 0; i < Math.min(max, templates.length); i++) {
      const tpl = templates[i]!;
      const q: SurveyQuestion = {
        id: `Q${i + 1}`,
        type: tpl[0],
        prompt: tpl[1],
        required: i < 3,
      };
      if (q.type === 'single') q.options = ['매일', '주 1회', '월 1회', '분기 1회', '거의 없음'];
      if (q.type === 'multi') q.options = ['접근성', '정확성', '속도', '편의성', '지원'];
      questions.push(q);
    }

    return {
      surveyId: `SV-${Date.now()}`,
      title: `${input.audience} 대상 ${stem} 설문`,
      purpose: stem,
      targetAudience: input.audience,
      questions,
      estimatedMinutes: Math.ceil(questions.length * 0.5),
    };
  }

  /** FR-N411.2: 집계 */
  aggregate(draft: SurveyDraft, responses: SurveyResponse[]): SurveyAggregation {
    const total = responses.length;
    let completed = 0;
    for (const r of responses) {
      const answered = draft.questions
        .filter((q) => q.required)
        .every((q) => r.answers[q.id] !== undefined && r.answers[q.id] !== '');
      if (answered) completed++;
    }
    const perQuestion = draft.questions.map((q) => {
      const distribution: Record<string, number> = {};
      let sum = 0;
      let count = 0;
      for (const r of responses) {
        const v = r.answers[q.id];
        if (v === undefined) continue;
        if (Array.isArray(v)) {
          for (const opt of v) distribution[opt] = (distribution[opt] ?? 0) + 1;
        } else {
          const key = String(v);
          distribution[key] = (distribution[key] ?? 0) + 1;
          if (q.type === 'likert5' && typeof v === 'number') {
            sum += v;
            count++;
          }
        }
      }
      const entry: { questionId: string; distribution: Record<string, number>; mean?: number } = {
        questionId: q.id,
        distribution,
      };
      if (count > 0) entry.mean = +(sum / count).toFixed(2);
      return entry;
    });
    return {
      surveyId: draft.surveyId,
      totalResponses: total,
      completionRate: total > 0 ? +(completed / total).toFixed(3) : 0,
      perQuestion,
    };
  }

  /** FR-N411.3: 자유응답 감성/토픽 간이 분석 */
  analyzeFreetext(questionId: string, texts: string[]): FreetextInsight {
    const positiveWords = ['좋', '만족', '편리', '우수', '훌륭', '감사'];
    const negativeWords = ['불편', '나쁨', '불만', '느림', '오류', '문제'];
    const topicMap = new Map<string, { count: number; sentimentSum: number }>();
    let pos = 0;
    let neg = 0;
    let neu = 0;
    const samples: string[] = [];

    for (const raw of texts) {
      const text = raw.trim();
      if (!text) continue;
      const sentiment = this.scoreSentiment(text, positiveWords, negativeWords);
      if (sentiment > 0.2) pos++;
      else if (sentiment < -0.2) neg++;
      else neu++;

      const tokens = text.split(/[\s,.\u3000]+/).filter((t) => t.length >= 2);
      for (const tok of tokens.slice(0, 8)) {
        const cur = topicMap.get(tok) ?? { count: 0, sentimentSum: 0 };
        cur.count++;
        cur.sentimentSum += sentiment;
        topicMap.set(tok, cur);
      }
      if (samples.length < 5) samples.push(text.slice(0, 80));
    }

    const topTopics = Array.from(topicMap.entries())
      .map(([topic, v]) => ({
        topic,
        count: v.count,
        sentiment: +(v.sentimentSum / Math.max(1, v.count)).toFixed(2),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalSent = Math.max(1, pos + neg + neu);
    return {
      questionId,
      topTopics,
      sentimentDistribution: {
        positive: +(pos / totalSent).toFixed(2),
        neutral: +(neu / totalSent).toFixed(2),
        negative: +(neg / totalSent).toFixed(2),
      },
      sampleQuotes: samples,
    };
  }

  private scoreSentiment(text: string, pos: string[], neg: string[]): number {
    let s = 0;
    for (const w of pos) if (text.includes(w)) s += 1;
    for (const w of neg) if (text.includes(w)) s -= 1;
    return Math.max(-1, Math.min(1, s / 3));
  }

  /** FR-N411.4: 편향/봇 탐지 */
  detectBias(responses: SurveyResponse[]): BiasFinding[] {
    const findings: BiasFinding[] = [];
    const byIp = new Map<string, number>();
    const fingerprints = new Map<string, number>();

    for (const r of responses) {
      if (r.ipHash) byIp.set(r.ipHash, (byIp.get(r.ipHash) ?? 0) + 1);
      const fp = JSON.stringify(r.answers);
      fingerprints.set(fp, (fingerprints.get(fp) ?? 0) + 1);
    }

    for (const r of responses) {
      const reasons: string[] = [];
      if (r.ipHash && (byIp.get(r.ipHash) ?? 0) > 3) reasons.push('동일 IP 다중 제출');
      const fp = JSON.stringify(r.answers);
      if ((fingerprints.get(fp) ?? 0) > 1) reasons.push('동일 응답 패턴');
      const values = Object.values(r.answers);
      if (values.length > 0 && values.every((v) => v === values[0])) reasons.push('일괄 동일값');
      if (reasons.length > 0) {
        findings.push({
          responseId: r.responseId,
          reasons,
          severity: reasons.length >= 2 ? 'high' : 'med',
        });
      }
    }
    return findings;
  }

  /** FR-N411.5: 공개 리포트 생성 */
  buildPublicReport(agg: SurveyAggregation, insights: FreetextInsight[]): string {
    const lines: string[] = [];
    lines.push(`# 설문 결과 공개 리포트 (${agg.surveyId})`);
    lines.push(`- 총 응답: ${agg.totalResponses}`);
    lines.push(`- 완료율: ${(agg.completionRate * 100).toFixed(1)}%`);
    lines.push('');
    lines.push('## 문항별 요약');
    for (const q of agg.perQuestion) {
      lines.push(`### ${q.questionId}`);
      if (q.mean !== undefined) lines.push(`- 평균(5점): ${q.mean}`);
      for (const [k, v] of Object.entries(q.distribution)) lines.push(`- ${k}: ${v}`);
    }
    if (insights.length > 0) {
      lines.push('\n## 자유응답 인사이트');
      for (const ins of insights) {
        lines.push(`### ${ins.questionId}`);
        lines.push(
          `- 긍정 ${Math.round(ins.sentimentDistribution.positive * 100)}% / 중립 ${Math.round(
            ins.sentimentDistribution.neutral * 100,
          )}% / 부정 ${Math.round(ins.sentimentDistribution.negative * 100)}%`,
        );
        lines.push(`- 주요 토픽: ${ins.topTopics.map((t) => t.topic).join(', ')}`);
      }
    }
    return lines.join('\n');
  }
}

export const publicSurveyAI = new PublicSurveyAI();
