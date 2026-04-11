// AI 규제 준수 검증기 — FR-ADV28.1~28.6
// Design Ref: SVC-AI-ADV-R28 DESIGN §1~§5
// Plan SC: SC-1 (체크리스트), SC-2 (자동 검증), SC-3 (보고서), SC-4 (위험 등급)
// CSAP: D-12 AI 보안 개발, D-06 규제 준수 감사
// N2SF: N-05 규제 메타데이터만 처리

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 규제 프레임워크 */
export type RegulatoryFramework = 'CSAP' | 'N2SF' | 'AI_ETHICS' | 'ISMS_P';

/** 준수 상태 */
export type ComplianceStatus = 'compliant' | 'non_compliant' | 'not_applicable' | 'partial';

/** 심각도 */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** 증거 유형 — Design §2 */
export type EvidenceType = 'code_pattern' | 'config' | 'log' | 'documentation' | 'test';

/** 규제 체크리스트 항목 — Design §1 */
export interface ComplianceCheckItem {
  id: string;
  framework: RegulatoryFramework;
  category: string;
  requirement: string;
  description: string;
  severity: Severity;
  evidenceType: EvidenceType;
  evidencePattern?: string;
  automatable: boolean;
}

/** 검증 증거 */
export interface ComplianceEvidence {
  checkId: string;
  status: ComplianceStatus;
  evidence: string;
  filePath?: string;
  lineNumber?: number;
  timestamp: string;
}

/** AI 위험 등급 — Design §4 */
export type AIRiskLevel = 'high' | 'medium' | 'low';

/** AI 시스템 위험 평가 */
export interface AIRiskAssessment {
  systemName: string;
  riskLevel: AIRiskLevel;
  factors: string[];
  mitigations: string[];
  assessedAt: string;
}

/** 개선 권고 — Design §5 */
export interface ComplianceRecommendation {
  checkId: string;
  priority: Severity;
  title: string;
  description: string;
  codeExample?: string;
  reference?: string;
}

/** 준수 보고서 — Design §3 */
export interface ComplianceReport {
  id: string;
  systemName: string;
  framework: RegulatoryFramework;
  overallRate: number;
  totalItems: number;
  compliantItems: number;
  nonCompliantItems: number;
  notApplicableItems: number;
  results: ComplianceEvidence[];
  riskAssessment: AIRiskAssessment;
  recommendations: ComplianceRecommendation[];
  generatedAt: string;
}

// ── CSAP AI 체크리스트 — Design §1 ─────────────────────────────────────────

/** CSAP AI 관련 체크리스트 */
export const CSAP_AI_CHECKLIST: ComplianceCheckItem[] = [
  {
    id: 'CSAP-D06-AI-01',
    framework: 'CSAP',
    category: '감사 로깅',
    requirement: 'AI 추론 결과 감사 로그 기록',
    description: '모든 AI 추론 요청/응답에 대한 감사 로그를 기록해야 합니다',
    severity: 'critical',
    evidenceType: 'code_pattern',
    evidencePattern: 'logAiEvent|auditLog|createServiceAuditLogger',
    automatable: true,
  },
  {
    id: 'CSAP-D08-AI-02',
    framework: 'CSAP',
    category: '접근 통제',
    requirement: 'AI API 엔드포인트 인증/인가',
    description: '모든 AI API 엔드포인트에 RBAC 기반 접근 통제가 적용되어야 합니다',
    severity: 'critical',
    evidenceType: 'code_pattern',
    evidencePattern: 'verifyToken|hasPermission|authenticate',
    automatable: true,
  },
  {
    id: 'CSAP-D09-AI-03',
    framework: 'CSAP',
    category: '암호화',
    requirement: 'AI 입출력 데이터 PII 마스킹',
    description: 'AI API 전송 전 개인식별정보(PII) 마스킹 처리 필수',
    severity: 'critical',
    evidenceType: 'code_pattern',
    evidencePattern: 'maskPII|pii-masking|piiMask',
    automatable: true,
  },
  {
    id: 'CSAP-D10-AI-04',
    framework: 'CSAP',
    category: '리소스 관리',
    requirement: 'AI 사용량 제한 (Rate Limiting)',
    description: '테넌트별 AI API 호출 속도 및 할당량 제한 적용',
    severity: 'high',
    evidenceType: 'code_pattern',
    evidencePattern: 'rateLimiter|RateLimit|usageLimit|quota',
    automatable: true,
  },
  {
    id: 'CSAP-D12-AI-05',
    framework: 'CSAP',
    category: '시스템 개발 보안',
    requirement: 'AI 입력 검증 (Prompt Injection 방지)',
    description: '사용자 입력에 대한 프롬프트 인젝션 방지 검증 적용',
    severity: 'critical',
    evidenceType: 'code_pattern',
    evidencePattern: 'promptGuard|promptInjection|contentFilter|inputValidation',
    automatable: true,
  },
];

/** 행안부 AI 윤리 체크리스트 */
export const AI_ETHICS_CHECKLIST: ComplianceCheckItem[] = [
  {
    id: 'ETH-01',
    framework: 'AI_ETHICS',
    category: '투명성',
    requirement: 'AI 판단 근거 설명 기능',
    description: 'AI 의사결정의 추론 과정과 근거를 사용자에게 설명할 수 있어야 합니다',
    severity: 'high',
    evidenceType: 'code_pattern',
    evidencePattern: 'explainability|reasoningChain|citation|ReasoningTracer',
    automatable: true,
  },
  {
    id: 'ETH-02',
    framework: 'AI_ETHICS',
    category: '공정성',
    requirement: 'AI 편향 모니터링',
    description: 'AI 응답의 성별/연령/지역별 편향을 지속적으로 모니터링해야 합니다',
    severity: 'high',
    evidenceType: 'code_pattern',
    evidencePattern: 'detectBias|biasDetection|fairness|BiasDetectionResult',
    automatable: true,
  },
  {
    id: 'ETH-03',
    framework: 'AI_ETHICS',
    category: '안전성',
    requirement: 'AI 콘텐츠 안전 필터',
    description: '유해/부적절 콘텐츠 생성을 방지하는 안전 필터가 적용되어야 합니다',
    severity: 'critical',
    evidenceType: 'code_pattern',
    evidencePattern: 'contentFilter|guardrails|safety|hallucination',
    automatable: true,
  },
  {
    id: 'ETH-04',
    framework: 'AI_ETHICS',
    category: '프라이버시',
    requirement: 'N2SF 데이터 등급 준수',
    description: 'C/S등급 데이터의 AI API 전송을 차단해야 합니다',
    severity: 'critical',
    evidenceType: 'code_pattern',
    evidencePattern: 'gradeCheck|DataGrade|N2SF|dataClassification',
    automatable: true,
  },
];

// ── 자동 검증 — Design §2 ──────────────────────────────────────────────────

/**
 * 코드 패턴 기반 검증
 * 소스 코드에서 필요한 패턴이 존재하는지 확인
 */
export function verifyCodePattern(
  sourceCode: string,
  pattern: string,
): { found: boolean; matchCount: number; matches: string[] } {
  const regex = new RegExp(pattern, 'gi');
  const matches: string[] = [];
  let match = regex.exec(sourceCode);
  while (match !== null) {
    matches.push(match[0]);
    match = regex.exec(sourceCode);
  }
  return {
    found: matches.length > 0,
    matchCount: matches.length,
    matches: [...new Set(matches)],
  };
}

/**
 * 체크리스트 항목 검증
 */
export function verifyCheckItem(
  item: ComplianceCheckItem,
  sourceCode: string,
): ComplianceEvidence {
  if (!item.automatable || !item.evidencePattern) {
    return {
      checkId: item.id,
      status: 'not_applicable',
      evidence: '자동 검증 불가 — 수동 검토 필요',
      timestamp: new Date().toISOString(),
    };
  }

  const result = verifyCodePattern(sourceCode, item.evidencePattern);

  return {
    checkId: item.id,
    status: result.found ? 'compliant' : 'non_compliant',
    evidence: result.found
      ? `패턴 발견: ${result.matches.join(', ')} (${result.matchCount}건)`
      : `필수 패턴 미발견: ${item.evidencePattern}`,
    timestamp: new Date().toISOString(),
  };
}

// ── 위험 등급 — Design §4 ──────────────────────────────────────────────────

/**
 * AI 시스템 위험 등급 평가
 */
export function assessRisk(
  systemName: string,
  capabilities: string[],
): AIRiskAssessment {
  const factors: string[] = [];
  const mitigations: string[] = [];
  let riskScore = 0;

  // 고위험 요소
  const highRiskCaps = ['pii_processing', 'decision_making', 'autonomous_action'];
  for (const cap of capabilities) {
    if (highRiskCaps.includes(cap)) {
      riskScore += 3;
      factors.push(`고위험 기능: ${cap}`);
      mitigations.push(`${cap}에 대한 인간 감독 메커니즘 적용`);
    }
  }

  // 중위험 요소
  const medRiskCaps = ['document_generation', 'search', 'analysis'];
  for (const cap of capabilities) {
    if (medRiskCaps.includes(cap)) {
      riskScore += 1;
      factors.push(`중위험 기능: ${cap}`);
    }
  }

  let riskLevel: AIRiskLevel;
  if (riskScore >= 6) {
    riskLevel = 'high';
    mitigations.push('정기적 편향 감사 실시');
    mitigations.push('인간 검토 프로세스 의무화');
  } else if (riskScore >= 3) {
    riskLevel = 'medium';
    mitigations.push('자동 품질 모니터링 적용');
  } else {
    riskLevel = 'low';
  }

  return {
    systemName,
    riskLevel,
    factors,
    mitigations,
    assessedAt: new Date().toISOString(),
  };
}

// ── 개선 권고 — Design §5 ──────────────────────────────────────────────────

/** 미준수 항목에 대한 개선 권고 생성 */
export function generateRecommendations(
  checkItems: ComplianceCheckItem[],
  results: ComplianceEvidence[],
): ComplianceRecommendation[] {
  const recommendations: ComplianceRecommendation[] = [];

  for (const result of results) {
    if (result.status !== 'non_compliant') continue;

    const item = checkItems.find((i) => i.id === result.checkId);
    if (!item) continue;

    recommendations.push({
      checkId: item.id,
      priority: item.severity,
      title: `[${item.framework}] ${item.requirement} 미준수`,
      description: item.description,
      codeExample: getCodeExample(item.id),
      reference: `${item.framework} ${item.category}`,
    });
  }

  return recommendations.sort((a, b) => {
    const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });
}

/** 항목별 코드 예시 */
function getCodeExample(checkId: string): string {
  const examples: Record<string, string> = {
    'CSAP-D06-AI-01': `import { logAiEvent } from './audit.js';\nawait logAiEvent('AI_INFERENCE', userId, requestId, tenantId, ip, userAgent, { model });`,
    'CSAP-D09-AI-03': `import { maskPII } from './pii-masking.js';\nconst maskedInput = maskPII(userInput);`,
    'CSAP-D12-AI-05': `import { detectPromptInjection } from './prompt-injection-detector.js';\nif (detectPromptInjection(input)) throw new Error('Blocked');`,
    'ETH-01': `import { ReasoningTracer } from './ai-explainability.js';\nconst tracer = new ReasoningTracer();`,
    'ETH-02': `import { detectBias } from './ai-explainability.js';\nconst biasResults = detectBias(response);`,
  };
  return examples[checkId] ?? '// 해당 항목에 대한 구현 코드를 추가하세요';
}

// ── 통합 보고서 생성 — Design §3 ───────────────────────────────────────────

/**
 * 전체 규제 준수 보고서 생성
 */
export function generateComplianceReport(
  systemName: string,
  framework: RegulatoryFramework,
  sourceCode: string,
  capabilities: string[],
): ComplianceReport {
  const checklist = framework === 'CSAP'
    ? CSAP_AI_CHECKLIST
    : framework === 'AI_ETHICS'
      ? AI_ETHICS_CHECKLIST
      : [...CSAP_AI_CHECKLIST, ...AI_ETHICS_CHECKLIST];

  const results = checklist.map((item) => verifyCheckItem(item, sourceCode));

  const compliant = results.filter((r) => r.status === 'compliant').length;
  const nonCompliant = results.filter((r) => r.status === 'non_compliant').length;
  const notApplicable = results.filter((r) => r.status === 'not_applicable').length;
  const applicable = results.length - notApplicable;
  const overallRate = applicable > 0 ? compliant / applicable : 0;

  const riskAssessment = assessRisk(systemName, capabilities);
  const recommendations = generateRecommendations(checklist, results);

  return {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    systemName,
    framework,
    overallRate: Math.round(overallRate * 1000) / 1000,
    totalItems: results.length,
    compliantItems: compliant,
    nonCompliantItems: nonCompliant,
    notApplicableItems: notApplicable,
    results,
    riskAssessment,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}
