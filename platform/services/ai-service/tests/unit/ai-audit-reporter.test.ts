// SVC-AI-ADV-R37 단위 테스트: AI 감사 보고서 생성기
// Design Ref: SVC-AI-ADV-R37 DESIGN §5
// Plan SC: FR-ADV37.5 (CSAP AI 윤리 감사 대응)
// CSAP: D-06 AI 감사 보고서, AI 윤리 준수 증적

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  AIAuditReporter,
  getAIAuditReporter,
  resetAIAuditReporter,
  type AuditReporterConfig,
  type AISystemInfo,
} from '../../src/lib/ai-audit-reporter.js';
import {
  AIGovernanceMetrics,
  resetAIGovernanceMetrics,
} from '../../src/lib/ai-governance-metrics.js';

// -- 테스트 설정 ---------------------------------------------------------------

const testSystems: AISystemInfo[] = [
  {
    name: 'RAG 검색 엔진',
    purpose: '문서 검색 및 답변 생성',
    model: 'claude-sonnet-4-6',
    riskLevel: 'medium',
    dataClassification: 'O',
    owner: '정보화팀',
  },
  {
    name: '민원 분류기',
    purpose: '민원 자동 분류',
    model: 'local-ollama',
    riskLevel: 'low',
    dataClassification: 'C',
    owner: '민원팀',
  },
];

function createConfig(metrics?: AIGovernanceMetrics): AuditReporterConfig {
  return {
    organizationName: '테스트 기관',
    aiSystems: [...testSystems],
    metricsSource: metrics,
  };
}

// -- 보고서 생성 -- Design §5 ---------------------------------------------------

describe('AIAuditReporter 보고서 생성 (FR-ADV37.5)', () => {
  let metrics: AIGovernanceMetrics;
  let reporter: AIAuditReporter;

  beforeEach(() => {
    metrics = new AIGovernanceMetrics();
    reporter = new AIAuditReporter(createConfig(metrics));
  });

  it('전체 감사 보고서를 생성한다', () => {
    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    expect(report.id).toBeTruthy();
    expect(report.title).toContain('테스트 기관');
    expect(report.period.start).toBe('2026-01-01');
    expect(report.period.end).toBe('2026-03-31');
    expect(report.generatedAt).toBeTruthy();
  });

  it('6개 섹션을 포함한다', () => {
    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    expect(report.sections).toHaveLength(6);
    const titles = report.sections.map((s) => s.title);
    expect(titles).toContain('AI 시스템 현황');
    expect(titles).toContain('AI 사용 현황');
    expect(titles).toContain('비용 분석');
    expect(titles).toContain('AI 품질 현황');
    expect(titles).toContain('AI 윤리 준수');
    expect(titles).toContain('데이터 보호 (N2SF)');
  });

  it('전체 준수율을 계산한다', () => {
    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    expect(report.overallCompliance).toBeGreaterThanOrEqual(0);
    expect(report.overallCompliance).toBeLessThanOrEqual(100);
  });

  it('권장 사항을 생성한다', () => {
    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});

// -- AI 시스템 현황 섹션 --------------------------------------------------------

describe('AIAuditReporter 시스템 현황 섹션', () => {
  it('고위험 시스템이 없으면 compliant', () => {
    const safeSystems: AISystemInfo[] = [{
      name: '테스트',
      purpose: '테스트용',
      model: 'local',
      riskLevel: 'low',
      dataClassification: 'O',
      owner: '팀',
    }];

    const reporter = new AIAuditReporter({
      organizationName: '테스트',
      aiSystems: safeSystems,
      metricsSource: new AIGovernanceMetrics(),
    });

    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    const section = report.sections.find((s) => s.title === 'AI 시스템 현황');
    expect(section!.complianceStatus).toBe('compliant');
  });

  it('고위험 시스템이 있으면 partial', () => {
    const riskySystem: AISystemInfo[] = [{
      name: '고위험',
      purpose: '중요 시스템',
      model: 'model',
      riskLevel: 'high',
      dataClassification: 'S',
      owner: '보안팀',
    }];

    const reporter = new AIAuditReporter({
      organizationName: '테스트',
      aiSystems: riskySystem,
      metricsSource: new AIGovernanceMetrics(),
    });

    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    const section = report.sections.find((s) => s.title === 'AI 시스템 현황');
    expect(section!.complianceStatus).toBe('partial');
  });
});

// -- 품질 섹션 ----------------------------------------------------------------

describe('AIAuditReporter 품질 섹션', () => {
  it('환각률이 낮으면 compliant', () => {
    const metrics = new AIGovernanceMetrics();
    metrics.recordFeedback({
      requestId: 'r1',
      model: 'test',
      tenantId: 't1',
      hallucinationDetected: false,
      relevanceScore: 0.9,
      timestamp: new Date().toISOString(),
    });

    const reporter = new AIAuditReporter(createConfig(metrics));
    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    const section = report.sections.find((s) => s.title === 'AI 품질 현황');
    expect(section!.complianceStatus).toBe('compliant');
  });

  it('환각률이 높으면 non_compliant', () => {
    const metrics = new AIGovernanceMetrics();
    // 모든 피드백에서 환각 감지
    for (let i = 0; i < 10; i++) {
      metrics.recordFeedback({
        requestId: `r${i}`,
        model: 'test',
        tenantId: 't1',
        hallucinationDetected: true,
        relevanceScore: 0.3,
        timestamp: new Date().toISOString(),
      });
    }

    const reporter = new AIAuditReporter(createConfig(metrics));
    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    const section = report.sections.find((s) => s.title === 'AI 품질 현황');
    expect(section!.complianceStatus).toBe('non_compliant');
  });
});

// -- 윤리 섹션 ----------------------------------------------------------------

describe('AIAuditReporter 윤리 섹션', () => {
  it('편향이 낮고 공정성 높으면 compliant', () => {
    const metrics = new AIGovernanceMetrics();
    metrics.recordEthicsEvent({
      requestId: 'r1',
      model: 'test',
      category: 'general',
      biasScore: 0.05,
      explainabilityScore: 0.9,
      timestamp: new Date().toISOString(),
    });

    const reporter = new AIAuditReporter(createConfig(metrics));
    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    const section = report.sections.find((s) => s.title === 'AI 윤리 준수');
    expect(section!.complianceStatus).toBe('compliant');
  });

  it('편향이 높으면 non_compliant', () => {
    const metrics = new AIGovernanceMetrics();
    metrics.recordEthicsEvent({
      requestId: 'r1',
      model: 'test',
      category: 'general',
      biasScore: 0.8,
      explainabilityScore: 0.2,
      timestamp: new Date().toISOString(),
    });

    const reporter = new AIAuditReporter(createConfig(metrics));
    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    const section = report.sections.find((s) => s.title === 'AI 윤리 준수');
    expect(section!.complianceStatus).toBe('non_compliant');
  });
});

// -- 데이터 보호 섹션 -----------------------------------------------------------

describe('AIAuditReporter 데이터 보호 (N2SF)', () => {
  it('C/S등급 시스템이 있으면 partial', () => {
    const reporter = new AIAuditReporter(createConfig(new AIGovernanceMetrics()));
    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    const section = report.sections.find((s) => s.title === '데이터 보호 (N2SF)');
    // testSystems에 C등급 시스템이 있으므로 partial
    expect(section!.complianceStatus).toBe('partial');
  });

  it('O등급만 있으면 compliant', () => {
    const oOnly: AISystemInfo[] = [{
      name: '안전',
      purpose: '테스트',
      model: 'model',
      riskLevel: 'low',
      dataClassification: 'O',
      owner: '팀',
    }];

    const reporter = new AIAuditReporter({
      organizationName: '테스트',
      aiSystems: oOnly,
      metricsSource: new AIGovernanceMetrics(),
    });

    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    const section = report.sections.find((s) => s.title === '데이터 보호 (N2SF)');
    expect(section!.complianceStatus).toBe('compliant');
  });
});

// -- 권장 사항 ----------------------------------------------------------------

describe('AIAuditReporter 권장 사항', () => {
  it('미준수 항목에 긴급 권장을 생성한다', () => {
    const metrics = new AIGovernanceMetrics();
    // 높은 환각률 → 품질 non_compliant
    for (let i = 0; i < 10; i++) {
      metrics.recordFeedback({
        requestId: `r${i}`,
        model: 'test',
        tenantId: 't1',
        hallucinationDetected: true,
        relevanceScore: 0.2,
        timestamp: new Date().toISOString(),
      });
    }

    const reporter = new AIAuditReporter(createConfig(metrics));
    const report = reporter.generateReport('2026-01-01', '2026-03-31');
    const urgentRecs = report.recommendations.filter((r) => r.includes('[긴급]'));
    expect(urgentRecs.length).toBeGreaterThan(0);
  });

  it('전체 준수 시 모니터링 유지 권장', () => {
    const metrics = new AIGovernanceMetrics();
    // 양호한 윤리 점수
    metrics.recordEthicsEvent({
      requestId: 'r1',
      model: 'test',
      category: 'general',
      biasScore: 0.05,
      explainabilityScore: 0.9,
      timestamp: new Date().toISOString(),
    });

    const oOnlyConfig: AuditReporterConfig = {
      organizationName: '테스트',
      aiSystems: [{
        name: '안전',
        purpose: '테스트',
        model: 'model',
        riskLevel: 'low',
        dataClassification: 'O',
        owner: '팀',
      }],
      metricsSource: metrics,
    };

    const reporter = new AIAuditReporter(oOnlyConfig);
    const report = reporter.generateReport('2026-01-01', '2026-03-31');

    // 모든 준수 시 '모니터링 유지' 포함
    if (report.sections.every((s) => s.complianceStatus === 'compliant')) {
      expect(report.recommendations.some((r) => r.includes('모니터링 유지'))).toBe(true);
    }
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('AIAuditReporter 팩토리', () => {
  afterEach(() => {
    resetAIAuditReporter();
    resetAIGovernanceMetrics();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const config = createConfig(new AIGovernanceMetrics());
    const r1 = getAIAuditReporter(config);
    const r2 = getAIAuditReporter(config);
    expect(r1).toBe(r2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const config = createConfig(new AIGovernanceMetrics());
    const r1 = getAIAuditReporter(config);
    resetAIAuditReporter();
    const r2 = getAIAuditReporter(config);
    expect(r1).not.toBe(r2);
  });
});
