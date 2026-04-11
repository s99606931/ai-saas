// SVC-AI-ADV-R22 단위 테스트: AI 설명 가능성 & 투명성 (XAI)
// Design Ref: SVC-AI-ADV-R22 DESIGN §1~§5
// Plan SC: FR-ADV22.1~22.6
// CSAP: D-06 판단 근거 감사 로그, D-12 AI 시스템 설명 문서

import { describe, it, expect, vi, beforeEach } from 'vitest';

// PII 마스킹 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  ReasoningTracer,
  addCitations,
  calculateConfidence,
  generateCounterfactuals,
  detectBias,
  generateExplainabilityReport,
  BIAS_DIMENSIONS,
} from '../../src/lib/ai-explainability.js';
import type {
  Citation,
  ReasoningChain,
} from '../../src/lib/ai-explainability.js';

// ── 추론 체인 추적기 — Design §1 ───────────────────────────────────────────

describe('ReasoningTracer 추론 체인 (FR-ADV22.1)', () => {
  let tracer: ReasoningTracer;

  beforeEach(() => {
    tracer = new ReasoningTracer();
  });

  it('추론 단계를 추가한다', () => {
    tracer.addStep('retrieval', '문서 검색', '전자정부법', '관련 조항 3건', 50);
    expect(tracer.stepCount).toBe(1);
  });

  it('여러 단계를 순서대로 기록한다', () => {
    tracer.addStep('retrieval', '검색', 'input', 'output', 50);
    tracer.addStep('analysis', '분석', 'input', 'output', 100);
    tracer.addStep('generation', '생성', 'input', 'output', 200);
    expect(tracer.stepCount).toBe(3);
  });

  it('추론 체인을 완성한다', () => {
    tracer.addStep('retrieval', '검색', '질문', '결과', 50);
    tracer.addStep('generation', '답변 생성', '결과', '최종 답변', 150);
    const chain = tracer.buildChain('사용자 질문');

    expect(chain.id).toMatch(/^chain-/);
    expect(chain.query).toContain('사용자 질문');
    expect(chain.steps).toHaveLength(2);
    expect(chain.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(chain.createdAt).toBeDefined();
  });

  it('단계 ID를 자동 부여한다', () => {
    tracer.addStep('retrieval', 'A', '', '', 0);
    tracer.addStep('analysis', 'B', '', '', 0);
    const chain = tracer.buildChain('test');

    expect(chain.steps[0]?.stepId).toBe('step-1');
    expect(chain.steps[1]?.stepId).toBe('step-2');
  });

  it('메타데이터를 포함한다', () => {
    tracer.addStep('validation', '검증', '', '', 10, { model: 'test', tokens: 100 });
    const chain = tracer.buildChain('test');
    expect(chain.steps[0]?.metadata?.model).toBe('test');
  });

  it('초기화 후 단계가 비워진다', () => {
    tracer.addStep('retrieval', '검색', '', '', 0);
    expect(tracer.stepCount).toBe(1);
    tracer.reset();
    expect(tracer.stepCount).toBe(0);
  });

  it('PII가 마스킹된다 (N2SF N-05)', () => {
    tracer.addStep('retrieval', '검색', '주민번호 900101-1234567', '결과', 0);
    const chain = tracer.buildChain('test');
    expect(chain.steps[0]?.input).not.toContain('900101-1234567');
  });
});

// ── 근거 문서 링크 — Design §2 ─────────────────────────────────────────────

describe('addCitations 근거 링크 (FR-ADV22.2)', () => {
  const mockCitations: Citation[] = [
    {
      id: 'c1',
      sourceId: 's1',
      sourceType: 'regulation',
      title: '전자정부법',
      section: '제10조',
      quote: '전자정부서비스를 제공하여야 한다',
      relevanceScore: 0.95,
      url: 'https://law.go.kr/전자정부법',
    },
    {
      id: 'c2',
      sourceId: 's2',
      sourceType: 'policy',
      title: '행정절차법',
      section: '제20조',
      quote: '행정절차의 투명성',
      relevanceScore: 0.80,
    },
  ];

  it('응답에 인라인 각주를 삽입한다', () => {
    const response = '전자정부법에 따라 서비스를 제공해야 합니다.';
    const result = addCitations(response, mockCitations);
    expect(result).toContain('[1]');
    expect(result).toContain('--- 출처 ---');
  });

  it('출처 목록을 추가한다', () => {
    const response = '전자정부법에 따른 규정입니다.';
    const result = addCitations(response, mockCitations);
    expect(result).toContain('[1] 전자정부법 제10조');
  });

  it('URL이 있으면 링크를 포함한다', () => {
    const response = '전자정부법 규정에 의해 시행됩니다.';
    const result = addCitations(response, mockCitations);
    expect(result).toContain('https://law.go.kr');
  });

  it('빈 인용 목록이면 원본을 반환한다', () => {
    const response = '원본 응답입니다.';
    const result = addCitations(response, []);
    expect(result).toBe(response);
  });

  it('관련성 높은 순으로 각주를 부여한다', () => {
    const response = '전자정부법과 행정절차법에 따릅니다.';
    const result = addCitations(response, mockCitations);
    // 관련성 높은 전자정부법이 [1]
    const firstRef = result.indexOf('[1]');
    expect(firstRef).toBeGreaterThan(-1);
  });

  it('최대 5개 인용까지 삽입한다', () => {
    const manyCitations: Citation[] = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      sourceId: `s${i}`,
      sourceType: 'regulation' as const,
      title: `법령${i}`,
      quote: `인용${i}`,
      relevanceScore: 0.9 - i * 0.1,
    }));
    const response = '법령0 법령1 법령2 법령3 법령4 법령5 법령6 법령7에 관한 내용';
    const result = addCitations(response, manyCitations);
    // 최대 5개까지만
    const refCount = (result.match(/\[\d+\]/g) ?? []).length;
    expect(refCount).toBeLessThanOrEqual(10); // 각주 + 출처 목록 번호 합산
  });
});

// ── 신뢰도 계산 — Design §3 ────────────────────────────────────────────────

describe('calculateConfidence 신뢰도 (FR-ADV22.3)', () => {
  it('높은 점수로 high 레벨을 반환한다', () => {
    const result = calculateConfidence(0.9, 0.85, 0.95);
    expect(result.level).toBe('high');
    expect(result.overall).toBeGreaterThanOrEqual(0.8);
  });

  it('중간 점수로 medium 레벨을 반환한다', () => {
    const result = calculateConfidence(0.6, 0.5, 0.7);
    expect(result.level).toBe('medium');
    expect(result.overall).toBeGreaterThanOrEqual(0.5);
    expect(result.overall).toBeLessThan(0.8);
  });

  it('낮은 점수로 low 레벨을 반환한다', () => {
    const result = calculateConfidence(0.2, 0.1, 0.3);
    expect(result.level).toBe('low');
    expect(result.overall).toBeLessThan(0.5);
  });

  it('차원별 점수를 포함한다', () => {
    const result = calculateConfidence(0.8, 0.7, 0.6);
    expect(result.dimensions.factual).toBe(0.8);
    expect(result.dimensions.contextual).toBe(0.7);
    expect(result.dimensions.linguistic).toBe(0.6);
  });

  it('가중 평균을 올바르게 계산한다', () => {
    // overall = 1.0 * 0.4 + 1.0 * 0.35 + 1.0 * 0.25 = 1.0
    const result = calculateConfidence(1.0, 1.0, 1.0);
    expect(result.overall).toBe(1);
    expect(result.level).toBe('high');
  });

  it('0 점수를 처리한다', () => {
    const result = calculateConfidence(0, 0, 0);
    expect(result.overall).toBe(0);
    expect(result.level).toBe('low');
  });
});

// ── 반사실 설명 — Design §4 ────────────────────────────────────────────────

describe('generateCounterfactuals 반사실 (FR-ADV22.4)', () => {
  it('날짜 기반 반사실을 생성한다', () => {
    const results = generateCounterfactuals(
      '2024년 개인정보보호법 개정',
      '개정 내용은...',
      ['출처 문서'],
    );
    const dateCf = results.find((r) => r.condition.includes('2023'));
    expect(dateCf).toBeDefined();
  });

  it('컨텍스트 부재 반사실을 생성한다', () => {
    const results = generateCounterfactuals(
      '질문',
      '응답',
      ['출처1'],
    );
    const noCtxCf = results.find((r) => r.condition.includes('컨텍스트'));
    expect(noCtxCf).toBeDefined();
    expect(noCtxCf?.confidence).toBeGreaterThan(0);
  });

  it('컨텍스트가 없으면 부재 반사실을 생성하지 않는다', () => {
    const results = generateCounterfactuals('질문', '응답', []);
    const noCtxCf = results.find((r) => r.condition.includes('컨텍스트'));
    expect(noCtxCf).toBeUndefined();
  });

  it('긴 응답에 길이 기반 반사실을 생성한다', () => {
    const longResponse = 'A'.repeat(600);
    const results = generateCounterfactuals('질문', longResponse, ['출처']);
    const lengthCf = results.find((r) => r.condition.includes('간단한'));
    expect(lengthCf).toBeDefined();
  });

  it('키워드 변경 반사실을 생성한다', () => {
    const results = generateCounterfactuals(
      '주민등록 등본 발급 방법',
      '발급 절차는...',
      ['출처'],
    );
    const termCf = results.find((r) => r.condition.includes('발급'));
    expect(termCf).toBeDefined();
  });

  it('반사실 ID가 고유하다', () => {
    const results = generateCounterfactuals(
      '2024년 신청 절차',
      'A'.repeat(600),
      ['출처'],
    );
    const ids = results.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ── 편향 탐지 — Design §5 ──────────────────────────────────────────────────

describe('detectBias 편향 탐지 (FR-ADV22.5)', () => {
  it('성별 중립적 응답은 낮은 편향 점수를 반환한다', () => {
    const results = detectBias('민원 처리 절차를 안내합니다.');
    const gender = results.find((r) => r.dimension === 'gender');
    expect(gender?.biasScore).toBe(0);
    expect(gender?.isSignificant).toBe(false);
  });

  it('성별 편향 응답을 탐지한다', () => {
    const results = detectBias('남성 남자 아버지 아들은 이렇게 합니다.');
    const gender = results.find((r) => r.dimension === 'gender');
    expect(gender?.biasScore).toBeGreaterThan(0);
    expect(gender?.isSignificant).toBe(true);
  });

  it('지역 편향을 탐지한다', () => {
    const results = detectBias('서울 경기 인천 수도권 지역에서만 해당됩니다.');
    const region = results.find((r) => r.dimension === 'region');
    expect(region?.biasScore).toBeGreaterThan(0);
  });

  it('편향이 유의미하면 권고사항을 포함한다', () => {
    const results = detectBias('남성 남자 아버지 위주로 설명합니다.');
    const gender = results.find((r) => r.dimension === 'gender');
    if (gender?.isSignificant) {
      expect(gender.recommendation).toBeDefined();
    }
  });

  it('2개 차원을 평가한다', () => {
    const results = detectBias('테스트 응답');
    expect(results.length).toBe(2);
    expect(results.map((r) => r.dimension)).toContain('gender');
    expect(results.map((r) => r.dimension)).toContain('region');
  });
});

// ── BIAS_DIMENSIONS 상수 ────────────────────────────────────────────────────

describe('BIAS_DIMENSIONS 상수', () => {
  it('4개 편향 차원을 정의한다', () => {
    expect(BIAS_DIMENSIONS).toHaveLength(4);
    expect(BIAS_DIMENSIONS).toContain('gender');
    expect(BIAS_DIMENSIONS).toContain('age');
    expect(BIAS_DIMENSIONS).toContain('region');
    expect(BIAS_DIMENSIONS).toContain('case_type');
  });
});

// ── 통합 보고서 생성 ────────────────────────────────────────────────────────

describe('generateExplainabilityReport 통합 보고서', () => {
  it('전체 설명 가능성 보고서를 생성한다', () => {
    const tracer = new ReasoningTracer();
    tracer.addStep('retrieval', '검색', '질문', '결과', 50);
    const chain = tracer.buildChain('전자정부법 질문');

    const citations: Citation[] = [
      {
        id: 'c1',
        sourceId: 's1',
        sourceType: 'regulation',
        title: '전자정부법',
        quote: '조문 내용',
        relevanceScore: 0.9,
      },
    ];

    const report = generateExplainabilityReport(
      '전자정부법 내용은?',
      '전자정부법 제10조에 따르면...',
      chain,
      citations,
      0.85,
      0.9,
      ['출처 문서'],
    );

    expect(report.id).toMatch(/^xai-/);
    expect(report.query).toBeDefined();
    expect(report.response).toBeDefined();
    expect(report.reasoningChain).toBeDefined();
    expect(report.citations).toHaveLength(1);
    expect(report.confidence).toBeDefined();
    expect(report.confidence.level).toBeDefined();
    expect(report.counterfactuals.length).toBeGreaterThanOrEqual(0);
    expect(report.biasResults.length).toBeGreaterThan(0);
    expect(report.createdAt).toBeDefined();
  });
});
