// SVC-AI-ADV-R8 단위 테스트: AI 비용 최적화기
// Design Ref: SVC-AI-ADV-R8 DESIGN §2, §4
// Plan SC: FR-ADV8.4, FR-ADV8.6
// CSAP: D-12

import { describe, it, expect, beforeEach } from 'vitest';
import { CostOptimizer, createCostOptimizer } from '../../src/lib/cost-optimizer.js';
import type { ComplexityLevel, ClassificationResult, CostMetricsSummary } from '../../src/lib/cost-optimizer.js';

describe('CostOptimizer 복잡도 분류 (FR-ADV8.4)', () => {
  let optimizer: CostOptimizer;

  beforeEach(() => {
    optimizer = new CostOptimizer();
  });

  it('단순 질문을 simple로 분류한다', () => {
    const result = optimizer.classifyComplexity('주민등록 등본 발급 방법은?');
    expect(result.level).toBe('simple');
    expect(result.recommendedModel).toBe('haiku');
  });

  it('짧은 FAQ 질문을 simple로 분류한다', () => {
    const result = optimizer.classifyComplexity('영업시간은?');
    expect(result.level).toBe('simple');
  });

  it('법률 해석 질문을 expert로 분류한다', () => {
    // "법률 해석" 패턴 → +4, 쿼리 길이>200이면 +2 추가 → 합계 4~6 → expert (>=3)
    // 짧으면 +4만 → expert
    const result = optimizer.classifyComplexity('개인정보보호법 제17조에 대한 심층적인 법률 해석을 요청합니다. 해당 조항의 위헌 가능성과 판례 분석을 포함해 주세요.');
    expect(result.level).toBe('expert');
    expect(result.recommendedModel).toBe('opus');
  });

  it('CSAP 감리 관련 질문을 expert로 분류한다', () => {
    const result = optimizer.classifyComplexity('CSAP 감리 결과에 대한 보안 감사 보고서를 작성하세요');
    expect(result.level).toBe('expert');
  });

  it('일반 질문을 standard로 분류한다', () => {
    // 30자 이상, 200자 이하, 패턴 미매칭 → score=0 → standard
    const result = optimizer.classifyComplexity('공공기관 정보화사업에서 예산을 수립하는 과정과 주요 고려사항에 대해 상세하게 설명해 주시기 바랍니다.');
    expect(result.level).toBe('standard');
    expect(result.recommendedModel).toBe('sonnet');
  });

  it('시스템 프롬프트에 전문가 키워드가 있으면 등급을 올린다', () => {
    // 30자 이상 쿼리(score=0) + 시스템 프롬프트 '법률 전문가'(+3) → score=3 → expert
    const result = optimizer.classifyComplexity(
      '다음 법령의 주요 조항과 적용 범위를 분석하고 실무적 시사점을 정리해 주세요.',
      '당신은 법률 전문가입니다.',
    );
    expect(result.level).toBe('expert');
  });

  it('다중 턴 대화는 등급을 올린다', () => {
    const shortQuery = optimizer.classifyComplexity('테스트', undefined, 1);
    const longConvo = optimizer.classifyComplexity('테스트', undefined, 10);
    // 10턴 대화는 +2 점수 → standard 이상
    expect(longConvo.level === 'standard' || longConvo.level === 'expert').toBe(true);
  });

  it('분류 결과에 confidence가 포함된다', () => {
    const result = optimizer.classifyComplexity('테스트 질문');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('분류 결과에 reason이 포함된다', () => {
    const result = optimizer.classifyComplexity('주민등록 등본 발급 절차는?');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('라우팅 통계를 누적한다', () => {
    optimizer.classifyComplexity('발급 방법?');
    optimizer.classifyComplexity('영업시간?');
    optimizer.classifyComplexity('법률 해석 해줘');
    const summary = optimizer.getMetricsSummary();
    const totalRouted = summary.routingDistribution.simple +
      summary.routingDistribution.standard +
      summary.routingDistribution.expert;
    expect(totalRouted).toBe(3);
  });
});

describe('CostOptimizer 비용 메트릭 (FR-ADV8.6)', () => {
  let optimizer: CostOptimizer;

  beforeEach(() => {
    optimizer = new CostOptimizer();
  });

  it('LLM 사용량을 기록한다', () => {
    optimizer.recordUsage('sonnet', 100, 200, 500);
    const summary = optimizer.getMetricsSummary();
    expect(summary.totalCalls).toBe(1);
    expect(summary.totalTokens).toBe(300);
  });

  it('여러 모델의 사용량을 별도로 추적한다', () => {
    optimizer.recordUsage('haiku', 50, 100, 200);
    optimizer.recordUsage('sonnet', 100, 200, 500);
    optimizer.recordUsage('opus', 200, 400, 1000);
    const summary = optimizer.getMetricsSummary();
    expect(summary.totalCalls).toBe(3);
    expect(summary.modelBreakdown).toHaveLength(3);
  });

  it('비용을 USD로 추정한다', () => {
    optimizer.recordUsage('sonnet', 1000, 1000, 500);
    const summary = optimizer.getMetricsSummary();
    expect(summary.totalEstimatedCostUSD).toBeGreaterThan(0);
  });

  it('캐시 절감액을 기록한다', () => {
    optimizer.recordCacheSaving(10000);
    const summary = optimizer.getMetricsSummary();
    expect(summary.savingsFromCache).toBeGreaterThan(0);
  });

  it('라우팅 절감액을 기록한다', () => {
    optimizer.recordRoutingSaving(0.005, 0.05);
    const summary = optimizer.getMetricsSummary();
    expect(summary.savingsFromRouting).toBeGreaterThan(0);
  });

  it('평균 레이턴시를 계산한다', () => {
    optimizer.recordUsage('sonnet', 100, 200, 300);
    optimizer.recordUsage('sonnet', 100, 200, 500);
    const summary = optimizer.getMetricsSummary();
    const sonnetMetric = summary.modelBreakdown.find((m) => m.modelId === 'sonnet')!;
    expect(sonnetMetric.averageLatencyMs).toBe(400);
  });

  it('메트릭 요약에 period가 포함된다', () => {
    const summary = optimizer.getMetricsSummary('2026-04-11');
    expect(summary.period).toBe('2026-04-11');
  });

  it('resetMetrics로 초기화한다', () => {
    optimizer.recordUsage('sonnet', 100, 200, 500);
    optimizer.resetMetrics();
    const summary = optimizer.getMetricsSummary();
    expect(summary.totalCalls).toBe(0);
    expect(summary.totalTokens).toBe(0);
  });
});

describe('createCostOptimizer 팩토리', () => {
  it('CostOptimizer 인스턴스를 생성한다', () => {
    const optimizer = createCostOptimizer();
    expect(optimizer).toBeInstanceOf(CostOptimizer);
  });

  it('커스텀 설정을 적용한다', () => {
    const optimizer = createCostOptimizer({
      tiers: [
        { level: 'simple', modelId: 'custom-small', costMultiplier: 1 },
        { level: 'standard', modelId: 'custom-medium', costMultiplier: 5 },
        { level: 'expert', modelId: 'custom-large', costMultiplier: 20 },
      ],
    });
    const result = optimizer.classifyComplexity('발급 방법?');
    expect(result.recommendedModel).toBe('custom-small');
  });
});
