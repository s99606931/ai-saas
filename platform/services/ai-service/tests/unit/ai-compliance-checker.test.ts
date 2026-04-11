// SVC-AI-ADV-R28 단위 테스트: AI 규제 준수 검증기
// Design Ref: SVC-AI-ADV-R28 DESIGN §1~§5
// Plan SC: FR-ADV28.1~28.6
// CSAP: D-12 AI 보안 개발, D-06 규제 준수 감사

import { describe, it, expect } from 'vitest';

import {
  CSAP_AI_CHECKLIST,
  AI_ETHICS_CHECKLIST,
  verifyCodePattern,
  verifyCheckItem,
  assessRisk,
  generateRecommendations,
  generateComplianceReport,
} from '../../src/lib/ai-compliance-checker.js';
import type { ComplianceCheckItem, ComplianceEvidence } from '../../src/lib/ai-compliance-checker.js';

// ── 체크리스트 상수 — Design §1 ────────────────────────────────────────────

describe('CSAP_AI_CHECKLIST 상수', () => {
  it('5개 CSAP AI 항목을 정의한다', () => {
    expect(CSAP_AI_CHECKLIST).toHaveLength(5);
  });

  it('모든 항목에 필수 필드가 있다', () => {
    for (const item of CSAP_AI_CHECKLIST) {
      expect(item.id).toBeDefined();
      expect(item.framework).toBe('CSAP');
      expect(item.requirement).toBeDefined();
      expect(item.severity).toBeDefined();
      expect(item.evidenceType).toBeDefined();
    }
  });

  it('critical 항목이 존재한다', () => {
    const critical = CSAP_AI_CHECKLIST.filter((i) => i.severity === 'critical');
    expect(critical.length).toBeGreaterThan(0);
  });
});

describe('AI_ETHICS_CHECKLIST 상수', () => {
  it('4개 윤리 항목을 정의한다', () => {
    expect(AI_ETHICS_CHECKLIST).toHaveLength(4);
  });

  it('투명성, 공정성, 안전성, 프라이버시를 포함한다', () => {
    const categories = AI_ETHICS_CHECKLIST.map((i) => i.category);
    expect(categories).toContain('투명성');
    expect(categories).toContain('공정성');
    expect(categories).toContain('안전성');
    expect(categories).toContain('프라이버시');
  });
});

// ── verifyCodePattern — Design §2 ──────────────────────────────────────────

describe('verifyCodePattern 코드 패턴 검증 (FR-ADV28.2)', () => {
  it('패턴이 존재하면 found=true를 반환한다', () => {
    const code = 'import { maskPII } from "./pii-masking.js";\nconst masked = maskPII(input);';
    const result = verifyCodePattern(code, 'maskPII');
    expect(result.found).toBe(true);
    expect(result.matchCount).toBeGreaterThanOrEqual(2);
  });

  it('패턴이 없으면 found=false를 반환한다', () => {
    const code = 'console.log("hello");';
    const result = verifyCodePattern(code, 'maskPII');
    expect(result.found).toBe(false);
    expect(result.matchCount).toBe(0);
  });

  it('OR 패턴을 지원한다', () => {
    const code = 'auditLog(event); logAiEvent(data);';
    const result = verifyCodePattern(code, 'logAiEvent|auditLog');
    expect(result.found).toBe(true);
    expect(result.matchCount).toBe(2);
  });

  it('중복을 제거한다', () => {
    const code = 'maskPII(a); maskPII(b); maskPII(c);';
    const result = verifyCodePattern(code, 'maskPII');
    expect(result.matches).toHaveLength(1); // 고유 매치
    expect(result.matchCount).toBe(3); // 총 매치 수
  });
});

// ── verifyCheckItem ─────────────────────────────────────────────────────────

describe('verifyCheckItem 항목 검증', () => {
  it('패턴이 있으면 compliant를 반환한다', () => {
    const item = CSAP_AI_CHECKLIST[2]!; // PII 마스킹 항목
    const code = 'import { maskPII } from "./pii-masking.js";';
    const result = verifyCheckItem(item, code);
    expect(result.status).toBe('compliant');
    expect(result.evidence).toContain('패턴 발견');
  });

  it('패턴이 없으면 non_compliant를 반환한다', () => {
    const item = CSAP_AI_CHECKLIST[2]!;
    const code = 'console.log("no masking");';
    const result = verifyCheckItem(item, code);
    expect(result.status).toBe('non_compliant');
  });

  it('자동 검증 불가 항목은 not_applicable을 반환한다', () => {
    const item: ComplianceCheckItem = {
      id: 'TEST-01', framework: 'CSAP', category: '테스트',
      requirement: '수동 검증', description: '', severity: 'low',
      evidenceType: 'documentation', automatable: false,
    };
    const result = verifyCheckItem(item, '');
    expect(result.status).toBe('not_applicable');
  });
});

// ── assessRisk 위험 등급 — Design §4 ──────────────────────────────────────

describe('assessRisk 위험 등급 (FR-ADV28.4)', () => {
  it('고위험 기능이 많으면 high를 반환한다', () => {
    const result = assessRisk('AI 시스템', ['pii_processing', 'decision_making', 'autonomous_action']);
    expect(result.riskLevel).toBe('high');
    expect(result.factors.length).toBeGreaterThan(0);
    expect(result.mitigations.length).toBeGreaterThan(0);
  });

  it('중위험 기능만 있으면 medium을 반환한다', () => {
    const result = assessRisk('AI 시스템', ['search', 'analysis', 'document_generation']);
    expect(result.riskLevel).toBe('medium');
  });

  it('위험 기능이 없으면 low를 반환한다', () => {
    const result = assessRisk('AI 시스템', ['greeting']);
    expect(result.riskLevel).toBe('low');
  });

  it('빈 기능 목록은 low를 반환한다', () => {
    const result = assessRisk('AI 시스템', []);
    expect(result.riskLevel).toBe('low');
  });

  it('시스템 이름을 포함한다', () => {
    const result = assessRisk('공공 AI 서비스', []);
    expect(result.systemName).toBe('공공 AI 서비스');
  });
});

// ── generateRecommendations — Design §5 ────────────────────────────────────

describe('generateRecommendations 개선 권고 (FR-ADV28.5)', () => {
  it('미준수 항목에 대해 권고를 생성한다', () => {
    const results: ComplianceEvidence[] = [
      { checkId: 'CSAP-D09-AI-03', status: 'non_compliant', evidence: '', timestamp: '' },
    ];
    const recs = generateRecommendations(CSAP_AI_CHECKLIST, results);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.checkId).toBe('CSAP-D09-AI-03');
    expect(recs[0]!.codeExample).toBeDefined();
  });

  it('준수 항목은 권고를 생성하지 않는다', () => {
    const results: ComplianceEvidence[] = [
      { checkId: 'CSAP-D09-AI-03', status: 'compliant', evidence: '', timestamp: '' },
    ];
    const recs = generateRecommendations(CSAP_AI_CHECKLIST, results);
    expect(recs).toHaveLength(0);
  });

  it('심각도 순으로 정렬한다', () => {
    const results: ComplianceEvidence[] = [
      { checkId: 'CSAP-D10-AI-04', status: 'non_compliant', evidence: '', timestamp: '' }, // high
      { checkId: 'CSAP-D06-AI-01', status: 'non_compliant', evidence: '', timestamp: '' }, // critical
    ];
    const recs = generateRecommendations(CSAP_AI_CHECKLIST, results);
    expect(recs[0]!.priority).toBe('critical');
    expect(recs[1]!.priority).toBe('high');
  });
});

// ── generateComplianceReport 통합 — Design §3 ──────────────────────────────

describe('generateComplianceReport 보고서 (FR-ADV28.3)', () => {
  it('CSAP 보고서를 생성한다', () => {
    const code = `
      import { logAiEvent } from './audit.js';
      import { maskPII } from './pii-masking.js';
      import { verifyToken } from './auth.js';
      const rateLimiter = new RateLimit();
      const guard = detectPromptInjection(input);
    `;
    const report = generateComplianceReport('AI 서비스', 'CSAP', code, ['search']);

    expect(report.id).toMatch(/^report-/);
    expect(report.systemName).toBe('AI 서비스');
    expect(report.framework).toBe('CSAP');
    expect(report.totalItems).toBe(5);
    expect(report.compliantItems + report.nonCompliantItems + report.notApplicableItems).toBe(5);
    expect(report.overallRate).toBeGreaterThanOrEqual(0);
    expect(report.overallRate).toBeLessThanOrEqual(1);
    expect(report.riskAssessment).toBeDefined();
    expect(report.generatedAt).toBeDefined();
  });

  it('AI_ETHICS 보고서를 생성한다', () => {
    const code = 'import { ReasoningTracer } from "./ai-explainability.js"; detectBias(); contentFilter(); gradeCheck();';
    const report = generateComplianceReport('AI 서비스', 'AI_ETHICS', code, []);
    expect(report.framework).toBe('AI_ETHICS');
    expect(report.totalItems).toBe(4);
  });

  it('빈 코드는 모든 항목이 non_compliant이다', () => {
    const report = generateComplianceReport('빈 서비스', 'CSAP', '', []);
    expect(report.nonCompliantItems).toBe(5);
    expect(report.overallRate).toBe(0);
  });
});
