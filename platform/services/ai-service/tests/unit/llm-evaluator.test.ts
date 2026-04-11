// SVC-AI-ADV-R16 단위 테스트: LLM 평가 프레임워크
// Design Ref: SVC-AI-ADV-R16 DESIGN §1~§5
// Plan SC: FR-ADV16.1~16.6
// CSAP: D-06 평가 결과 감사, D-12 시스템 개발 보안

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  calculateRAGMetrics,
  buildJudgePrompt,
  ruleBasedJudge,
  MetricCollector,
  BenchmarkRunner,
  evaluate,
} from '../../src/lib/llm-evaluator.js';
import type { EvaluationRequest, EvaluationResult, BenchmarkItem } from '../../src/lib/llm-evaluator.js';

// ── calculateRAGMetrics — Design §1 ──────────────────────────────────────

describe('calculateRAGMetrics RAG 품질 평가 (FR-ADV16.1)', () => {
  it('관련 컨텍스트 기반 응답의 faithfulness가 높다', () => {
    const query = '전자정부법 제10조 내용';
    const response = '전자정부법 제10조는 행정기관의 장이 전자정부서비스를 제공할 때 국민의 편의를 도모하여야 한다는 규정입니다.';
    const contexts = ['전자정부법 제10조는 행정기관의 장이 전자정부서비스를 제공할 때 국민의 편의를 도모합니다.'];

    const metrics = calculateRAGMetrics(query, response, contexts);
    expect(metrics.faithfulness).toBeGreaterThan(0);
    expect(metrics.overall).toBeGreaterThan(0);
    expect(metrics.overall).toBeLessThanOrEqual(1);
  });

  it('무관한 컨텍스트의 answerRelevancy가 낮다', () => {
    const query = '교통 민원';
    const response = '날씨가 좋습니다.';
    const contexts = ['오늘 비가 옵니다.'];

    const metrics = calculateRAGMetrics(query, response, contexts);
    expect(metrics.answerRelevancy).toBeLessThanOrEqual(0.5);
  });

  it('빈 컨텍스트의 contextPrecision은 0이다', () => {
    const metrics = calculateRAGMetrics('질문', '응답', []);
    expect(metrics.contextPrecision).toBe(0);
  });

  it('빈 응답의 faithfulness는 0이다', () => {
    const metrics = calculateRAGMetrics('질문', '', ['컨텍스트']);
    expect(metrics.faithfulness).toBe(0);
  });

  it('expectedAnswer 보너스가 적용된다', () => {
    const query = '전자정부법';
    const response = '전자정부법은 행정기관 서비스 법률입니다.';
    const contexts = ['전자정부법 관련 내용'];

    const withExpected = calculateRAGMetrics(
      query, response, contexts, '전자정부법은 행정기관 관련 법률',
    );
    const withoutExpected = calculateRAGMetrics(query, response, contexts);
    expect(withExpected.overall).toBeGreaterThanOrEqual(withoutExpected.overall);
  });

  it('overall이 0~1 범위이다', () => {
    const metrics = calculateRAGMetrics(
      '테스트 질문', '테스트 응답입니다. 상세한 내용을 포함합니다.',
      ['테스트 관련 컨텍스트'],
    );
    expect(metrics.overall).toBeGreaterThanOrEqual(0);
    expect(metrics.overall).toBeLessThanOrEqual(1);
  });
});

// ── buildJudgePrompt — Design §2 ────────────────────────────────────────

describe('buildJudgePrompt 프롬프트 생성', () => {
  it('PII를 마스킹한 프롬프트를 생성한다', () => {
    const prompt = buildJudgePrompt(
      '주민번호 900101-1234567 확인',
      '해당 주민번호의 정보입니다.',
    );
    expect(prompt).toContain('***-***');
    expect(prompt).not.toContain('900101-1234567');
    expect(prompt).toContain('factualCorrectness');
    expect(prompt).toContain('helpfulness');
  });

  it('평가 기준 4가지를 포함한다', () => {
    const prompt = buildJudgePrompt('질문', '응답');
    expect(prompt).toContain('정확성');
    expect(prompt).toContain('유용성');
    expect(prompt).toContain('안전성');
    expect(prompt).toContain('한국어 품질');
  });
});

// ── ruleBasedJudge — Design §2 ─────────────────────────────────────────

describe('ruleBasedJudge 규칙 기반 평가', () => {
  it('충분한 길이의 응답은 helpfulness가 높다', () => {
    const result = ruleBasedJudge(
      '전자정부법이란',
      '전자정부법은 행정기관의 장이 전자정부서비스를 제공할 때 국민의 편의를 도모하여야 한다는 법률로, 공공기관 디지털 전환의 근거가 됩니다. 이 법률은 2001년에 제정되어 전자정부의 기본 원칙, 행정정보의 공개, 행정정보의 공동이용 등에 대해 규정하고 있습니다.',
    );
    expect(result.helpfulness).toBeGreaterThanOrEqual(4);
  });

  it('짧은 응답은 helpfulness가 낮다', () => {
    const result = ruleBasedJudge('질문', '모름');
    expect(result.helpfulness).toBe(1);
  });

  it('유해 콘텐츠는 safety가 1이다', () => {
    const result = ruleBasedJudge('질문', '해킹 방법을 알려드리겠습니다.');
    expect(result.safety).toBe(1);
  });

  it('안전한 응답은 safety가 5이다', () => {
    const result = ruleBasedJudge('질문', '전자정부서비스에 대한 안내입니다.');
    expect(result.safety).toBe(5);
  });

  it('한국어 비율이 높으면 koreanQuality가 높다', () => {
    const result = ruleBasedJudge(
      '행정절차',
      '행정절차법에 따르면 모든 행정작용은 적법하게 이루어져야 합니다.',
    );
    expect(result.koreanQuality).toBeGreaterThanOrEqual(4);
  });

  it('질문 키워드가 반영되면 factualCorrectness가 높다', () => {
    const result = ruleBasedJudge(
      '전자정부법 행정기관',
      '전자정부법에 따라 행정기관은 디지털 서비스를 제공해야 합니다.',
    );
    expect(result.factualCorrectness).toBeGreaterThanOrEqual(4);
  });

  it('overallScore가 1~5 범위이다', () => {
    const result = ruleBasedJudge('질문', '응답');
    expect(result.overallScore).toBeGreaterThanOrEqual(1);
    expect(result.overallScore).toBeLessThanOrEqual(5);
  });

  it('reasoning이 포함된다', () => {
    const result = ruleBasedJudge('질문', '응답');
    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});

// ── MetricCollector — Design §3 ────────────────────────────────────────

describe('MetricCollector 메트릭 수집기 (FR-ADV16.3)', () => {
  let collector: MetricCollector;

  beforeEach(() => {
    collector = new MetricCollector(100);
  });

  it('메트릭을 기록한다', () => {
    collector.record('model-a', 'v1', 'rag_overall', 0.8);
    expect(collector.size).toBe(1);
  });

  it('평균을 계산한다', () => {
    collector.record('model-a', 'v1', 'rag_overall', 0.6);
    collector.record('model-a', 'v1', 'rag_overall', 0.8);
    expect(collector.getAverage('rag_overall')).toBe(0.7);
  });

  it('엔트리가 없으면 평균 0', () => {
    expect(collector.getAverage('nonexistent')).toBe(0);
  });

  it('모델별 요약을 반환한다', () => {
    collector.record('model-a', 'v1', 'rag_overall', 0.8);
    collector.record('model-a', 'v1', 'judge_overall', 0.7);
    const summary = collector.getSummary('model-a');
    expect(summary['rag_overall']).toBe(0.8);
    expect(summary['judge_overall']).toBe(0.7);
  });

  it('존재하지 않는 모델 요약은 빈 객체', () => {
    const summary = collector.getSummary('nonexistent');
    expect(Object.keys(summary)).toHaveLength(0);
  });

  it('최대 엔트리를 초과하면 오래된 것을 제거한다', () => {
    const small = new MetricCollector(5);
    for (let i = 0; i < 10; i++) {
      small.record('m', 'v1', 'metric', i);
    }
    expect(small.size).toBe(5);
    // 최근 5개: 5,6,7,8,9 -> 평균 = 7
    expect(small.getAverage('metric')).toBe(7);
  });

  it('평가 결과를 메트릭으로 변환한다', () => {
    const result: EvaluationResult = {
      id: 'eval-1',
      requestId: 'req-1',
      ragMetrics: { faithfulness: 0.8, answerRelevancy: 0.7, contextPrecision: 0.6, overall: 0.72 },
      judgeEvaluation: {
        factualCorrectness: 4, helpfulness: 4, safety: 5, koreanQuality: 4,
        reasoning: '양호', overallScore: 4.25,
      },
      timestamp: new Date().toISOString(),
      model: 'test-model',
      tenantId: 'tenant-1',
    };
    collector.recordEvaluation(result);
    expect(collector.size).toBe(5); // 4 RAG + 1 judge
    expect(collector.getAverage('rag_overall')).toBe(0.72);
  });
});

// ── BenchmarkRunner — Design §4 ──────────────────────────────────────────

describe('BenchmarkRunner 벤치마크 (FR-ADV16.4)', () => {
  let runner: BenchmarkRunner;

  beforeEach(() => {
    runner = new BenchmarkRunner();
  });

  it('벤치마크 항목을 추가한다', () => {
    runner.addItem({
      id: 'bench-1',
      query: '질문',
      contexts: ['컨텍스트'],
      expectedAnswer: '기대 답변',
      category: '법령',
      difficulty: 'easy',
    });
    expect(runner.size).toBe(1);
  });

  it('벤치마크를 실행한다', () => {
    runner.addItem({
      id: 'bench-1',
      query: '전자정부법이란',
      contexts: ['전자정부법 관련 내용'],
      expectedAnswer: '전자정부법은 행정기관 법률',
      category: '법령',
      difficulty: 'easy',
    });

    const result = runner.run((item: BenchmarkItem) => evaluate({
      id: item.id,
      query: item.query,
      response: '전자정부법은 행정기관의 장이 전자정부서비스를 제공하는 법률입니다.',
      contexts: item.contexts,
      expectedAnswer: item.expectedAnswer,
      model: 'test-model',
      tenantId: 'tenant-1',
    }));

    expect(result.totalItems).toBe(1);
    expect(result.passRate).toBeGreaterThanOrEqual(0);
    expect(result.passRate).toBeLessThanOrEqual(1);
    expect(result.avgRAGScore).toBeGreaterThanOrEqual(0);
    expect(result.avgJudgeScore).toBeGreaterThanOrEqual(0);
    expect(result.benchmarkId).toMatch(/^bench-/);
  });

  it('빈 벤치마크 결과는 모두 0', () => {
    const result = runner.run(() => ({
      id: '',
      requestId: '',
      ragMetrics: { faithfulness: 0, answerRelevancy: 0, contextPrecision: 0, overall: 0 },
      judgeEvaluation: {
        factualCorrectness: 1, helpfulness: 1, safety: 5, koreanQuality: 1,
        reasoning: '', overallScore: 2,
      },
      timestamp: '',
      model: '',
      tenantId: '',
    }));
    expect(result.totalItems).toBe(0);
    expect(result.passRate).toBe(0);
    expect(result.regressionDetected).toBe(false);
  });

  it('이전 점수 대비 5% 이상 하락 시 regression 감지', () => {
    // 첫 실행: 높은 점수
    runner.addItem({
      id: 'b1', query: 'q', contexts: ['c'], expectedAnswer: 'a',
      category: 'c', difficulty: 'easy',
    });

    runner.run(() => ({
      id: 'e1', requestId: 'b1',
      ragMetrics: { faithfulness: 0.9, answerRelevancy: 0.9, contextPrecision: 0.9, overall: 0.9 },
      judgeEvaluation: {
        factualCorrectness: 5, helpfulness: 5, safety: 5, koreanQuality: 5,
        reasoning: '', overallScore: 5,
      },
      timestamp: '', model: '', tenantId: '',
    }));

    // 두번째 실행: 크게 하락한 점수
    const result = runner.run(() => ({
      id: 'e2', requestId: 'b1',
      ragMetrics: { faithfulness: 0.1, answerRelevancy: 0.1, contextPrecision: 0.1, overall: 0.1 },
      judgeEvaluation: {
        factualCorrectness: 1, helpfulness: 1, safety: 1, koreanQuality: 1,
        reasoning: '', overallScore: 1,
      },
      timestamp: '', model: '', tenantId: '',
    }));

    expect(result.regressionDetected).toBe(true);
    expect(result.previousAvgScore).toBeGreaterThan(0);
  });
});

// ── evaluate 통합 평가 ────────────────────────────────────────────────────

describe('evaluate 통합 평가', () => {
  it('평가 결과를 생성한다', () => {
    const request: EvaluationRequest = {
      id: 'req-1',
      query: '전자정부법 내용 알려주세요',
      response: '전자정부법은 행정기관의 디지털 서비스 제공에 관한 법률입니다.',
      contexts: ['전자정부법 관련 정보'],
      model: 'test-model',
      tenantId: 'tenant-1',
    };

    const result = evaluate(request);
    expect(result.id).toMatch(/^eval-/);
    expect(result.requestId).toBe('req-1');
    expect(result.ragMetrics).toBeDefined();
    expect(result.judgeEvaluation).toBeDefined();
    expect(result.model).toBe('test-model');
    expect(result.tenantId).toBe('tenant-1');
  });

  it('promptVersion을 포함한다', () => {
    const result = evaluate({
      id: 'req-2',
      query: '질문',
      response: '응답',
      contexts: [],
      model: 'model',
      promptVersion: 'v2.1',
      tenantId: 'tenant-1',
    });
    expect(result.promptVersion).toBe('v2.1');
  });
});
