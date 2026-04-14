import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceInnovationIndexAI } from '../service-innovation-index-ai';
import { RootCauseAnalyzerV2 } from '../root-cause-analyzer-v2';
import { PublicWorkflowAutomationV2 } from '../public-workflow-automation-v2';
import { RealtimeCostAnomalyDetectorV2 } from '../realtime-cost-anomaly-detector-v2';
import { ServiceMeshVisibilityEnhancerAI } from '../service-mesh-visibility-enhancer-ai';
import { PublicDocumentAuthenticityVerifier } from '../public-document-authenticity-verifier';
import { ApiThrottlingOptimizerAI } from '../api-throttling-optimizer-ai';
import { MultitenantServiceIsolatorV3 } from '../multitenant-service-isolator-v3';
import { PublicServiceChannelAnalyzerV3 } from '../public-service-channel-analyzer-v3';

// ─── R538: ServiceInnovationIndexAI ─────────────────────────────────────────

describe('ServiceInnovationIndexAI', () => {
  let analyzer: ServiceInnovationIndexAI;

  beforeEach(() => {
    analyzer = new ServiceInnovationIndexAI();
  });

  it('INNOVATING 등급: 혁신지수 80 이상', () => {
    const result = analyzer.analyze({
      agencyId: 'GOV-001',
      digitalServiceRate: 90,
      processAutomationRate: 90,
      dataOpenRate: 80,
      citizenSatisfaction: 80,
    });
    // 90*0.3+90*0.3+80*0.2+80*0.2 = 27+27+16+16 = 86
    expect(result.grade).toBe('INNOVATING');
    expect(result.innovationIndex).toBeCloseTo(86, 1);
  });

  it('ADVANCING 등급: 혁신지수 60~79', () => {
    const result = analyzer.analyze({
      agencyId: 'GOV-002',
      digitalServiceRate: 70,
      processAutomationRate: 70,
      dataOpenRate: 60,
      citizenSatisfaction: 60,
    });
    // 70*0.3+70*0.3+60*0.2+60*0.2 = 21+21+12+12 = 66
    expect(result.grade).toBe('ADVANCING');
  });

  it('DEVELOPING 등급: 혁신지수 40~59', () => {
    const result = analyzer.analyze({
      agencyId: 'GOV-003',
      digitalServiceRate: 50,
      processAutomationRate: 50,
      dataOpenRate: 40,
      citizenSatisfaction: 40,
    });
    // 50*0.3+50*0.3+40*0.2+40*0.2 = 15+15+8+8 = 46
    expect(result.grade).toBe('DEVELOPING');
  });

  it('LAGGING 등급: 혁신지수 40 미만', () => {
    const result = analyzer.analyze({
      agencyId: 'GOV-004',
      digitalServiceRate: 20,
      processAutomationRate: 20,
      dataOpenRate: 20,
      citizenSatisfaction: 20,
    });
    expect(result.grade).toBe('LAGGING');
  });

  it('최저 지표 식별: 가장 낮은 항목 반환', () => {
    const result = analyzer.analyze({
      agencyId: 'GOV-005',
      digitalServiceRate: 80,
      processAutomationRate: 80,
      dataOpenRate: 10,
      citizenSatisfaction: 80,
    });
    expect(result.lowestMetric).toBe('dataOpenRate');
  });

  it('감사 로그 기록', () => {
    analyzer.analyze({ agencyId: 'GOV-006', digitalServiceRate: 50, processAutomationRate: 50, dataOpenRate: 50, citizenSatisfaction: 50 });
    const logs = analyzer.getAuditLog();
    expect(logs).toHaveLength(1);
    expect(logs[0]!.action).toBe('INNOVATION_ANALYZED');
    expect(logs[0]!.agencyId).toBe('GOV-006');
  });
});

// ─── R539: RootCauseAnalyzerV2 ───────────────────────────────────────────────

describe('RootCauseAnalyzerV2', () => {
  let analyzer: RootCauseAnalyzerV2;

  beforeEach(() => {
    analyzer = new RootCauseAnalyzerV2();
  });

  it('CODE_ERROR: errorRate > 0.5', () => {
    const result = analyzer.analyze({
      incidentId: 'INC-001', affectedService: 'svc-a',
      symptoms: ['500 errors'], errorRate: 0.6, latencySpike: 100, memUsage: 50,
    });
    expect(result.rootCause).toBe('CODE_ERROR');
    expect(result.severity).toBe('HIGH');
    expect(result.recommendation).toBe('SCALE_OUT');
  });

  it('CRITICAL: CODE_ERROR && errorRate > 0.8 → ROLLBACK', () => {
    const result = analyzer.analyze({
      incidentId: 'INC-002', affectedService: 'svc-b',
      symptoms: [], errorRate: 0.9, latencySpike: 100, memUsage: 50,
    });
    expect(result.severity).toBe('CRITICAL');
    expect(result.recommendation).toBe('ROLLBACK');
  });

  it('RESOURCE_EXHAUSTION: latencySpike > 5000', () => {
    const result = analyzer.analyze({
      incidentId: 'INC-003', affectedService: 'svc-c',
      symptoms: [], errorRate: 0.1, latencySpike: 6000, memUsage: 50,
    });
    expect(result.rootCause).toBe('RESOURCE_EXHAUSTION');
    expect(result.recommendation).toBe('SCALE_OUT');
  });

  it('MEMORY_LEAK: memUsage > 90 → RESTART', () => {
    const result = analyzer.analyze({
      incidentId: 'INC-004', affectedService: 'svc-d',
      symptoms: [], errorRate: 0.1, latencySpike: 100, memUsage: 95,
    });
    expect(result.rootCause).toBe('MEMORY_LEAK');
    expect(result.severity).toBe('MEDIUM');
    expect(result.recommendation).toBe('RESTART');
  });

  it('UNKNOWN: 모든 임계값 미달 → MONITOR', () => {
    const result = analyzer.analyze({
      incidentId: 'INC-005', affectedService: 'svc-e',
      symptoms: [], errorRate: 0.1, latencySpike: 100, memUsage: 50,
    });
    expect(result.rootCause).toBe('UNKNOWN');
    expect(result.severity).toBe('LOW');
    expect(result.recommendation).toBe('MONITOR');
  });

  it('감사 로그 기록', () => {
    analyzer.analyze({ incidentId: 'INC-006', affectedService: 'svc-f', symptoms: [], errorRate: 0.1, latencySpike: 100, memUsage: 50 });
    const logs = analyzer.getAuditLog();
    expect(logs).toHaveLength(1);
    expect(logs[0]!.action).toBe('ROOT_CAUSE_ANALYZED');
  });
});

// ─── R540: PublicWorkflowAutomationV2 ────────────────────────────────────────

describe('PublicWorkflowAutomationV2', () => {
  let automator: PublicWorkflowAutomationV2;

  beforeEach(() => {
    automator = new PublicWorkflowAutomationV2();
  });

  it('AUTOMATE: 자동화 점수 >= 70', () => {
    // 1.0*40 + min(15/10,1)*30 + min(120/60,1)*20 + 10 = 40+30+20+10 = 100
    const result = automator.evaluate({
      taskId: 'TASK-001', name: '급여 처리', repetitionRate: 1.0,
      manualSteps: 15, avgDurationMin: 120, errorProne: true,
    });
    expect(result.recommendation).toBe('AUTOMATE');
    expect(result.automationScore).toBe(100);
  });

  it('SEMI_AUTOMATE: 자동화 점수 40~69', () => {
    // 0.5*40 + min(5/10,1)*30 + min(30/60,1)*20 + 0 = 20+15+10+0 = 45
    const result = automator.evaluate({
      taskId: 'TASK-002', name: '민원 처리', repetitionRate: 0.5,
      manualSteps: 5, avgDurationMin: 30, errorProne: false,
    });
    expect(result.recommendation).toBe('SEMI_AUTOMATE');
  });

  it('MANUAL: 자동화 점수 < 40', () => {
    // 0.1*40 + min(1/10,1)*30 + min(5/60,1)*20 + 0 = 4+3+1.67+0 ≈ 8.67
    const result = automator.evaluate({
      taskId: 'TASK-003', name: '정책 검토', repetitionRate: 0.1,
      manualSteps: 1, avgDurationMin: 5, errorProne: false,
    });
    expect(result.recommendation).toBe('MANUAL');
  });

  it('예상 시간 절감 계산', () => {
    const result = automator.evaluate({
      taskId: 'TASK-004', name: '보고서 작성', repetitionRate: 0.8,
      manualSteps: 8, avgDurationMin: 60, errorProne: false,
    });
    // 60 * 0.8 * 0.8 = 38.4
    expect(result.estimatedTimeSavingsMin).toBeCloseTo(38.4, 1);
  });

  it('감사 로그 기록', () => {
    automator.evaluate({ taskId: 'TASK-005', name: '세금 처리', repetitionRate: 0.9, manualSteps: 10, avgDurationMin: 60, errorProne: true });
    const logs = automator.getAuditLog();
    expect(logs).toHaveLength(1);
    expect(logs[0]!.action).toBe('WORKFLOW_EVALUATED');
  });
});

// ─── R541: RealtimeCostAnomalyDetectorV2 ─────────────────────────────────────

describe('RealtimeCostAnomalyDetectorV2', () => {
  let detector: RealtimeCostAnomalyDetectorV2;

  beforeEach(() => {
    detector = new RealtimeCostAnomalyDetectorV2();
  });

  it('CRITICAL: actualCost > budgeted * 2', () => {
    const result = detector.detect({ serviceId: 'SVC-001', date: '2026-04-01', actualCost: 300, budgetedCost: 100, prevMonthCost: 100 });
    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe('CRITICAL');
  });

  it('HIGH: actualCost > budgeted * 1.5', () => {
    const result = detector.detect({ serviceId: 'SVC-002', date: '2026-04-01', actualCost: 160, budgetedCost: 100, prevMonthCost: 100 });
    expect(result.severity).toBe('HIGH');
    expect(result.isAnomaly).toBe(true);
  });

  it('MEDIUM: actualCost > budgeted * 1.2', () => {
    const result = detector.detect({ serviceId: 'SVC-003', date: '2026-04-01', actualCost: 125, budgetedCost: 100, prevMonthCost: 80 });
    expect(result.severity).toBe('MEDIUM');
    expect(result.isAnomaly).toBe(true);
  });

  it('NORMAL: 이상 없음', () => {
    const result = detector.detect({ serviceId: 'SVC-004', date: '2026-04-01', actualCost: 100, budgetedCost: 100, prevMonthCost: 100 });
    expect(result.isAnomaly).toBe(false);
    expect(result.severity).toBe('NORMAL');
  });

  it('prevMonth 기준 이상: actualCost > prevMonth * 1.5', () => {
    const result = detector.detect({ serviceId: 'SVC-005', date: '2026-04-01', actualCost: 115, budgetedCost: 200, prevMonthCost: 70 });
    // actual 115 > budget*1.2=240? No. actual 115 > prevMonth*1.5=105? Yes
    expect(result.isAnomaly).toBe(true);
  });

  it('초과율 계산', () => {
    const result = detector.detect({ serviceId: 'SVC-006', date: '2026-04-01', actualCost: 150, budgetedCost: 100, prevMonthCost: 100 });
    expect(result.overrunRate).toBeCloseTo(50, 1);
  });

  it('감사 로그 기록', () => {
    detector.detect({ serviceId: 'SVC-007', date: '2026-04-01', actualCost: 100, budgetedCost: 100, prevMonthCost: 100 });
    expect(detector.getAuditLog()).toHaveLength(1);
  });
});

// ─── R542: ServiceMeshVisibilityEnhancerAI ───────────────────────────────────

describe('ServiceMeshVisibilityEnhancerAI', () => {
  let enhancer: ServiceMeshVisibilityEnhancerAI;

  beforeEach(() => {
    enhancer = new ServiceMeshVisibilityEnhancerAI();
  });

  it('CRITICAL 엣지: latency > 1000', () => {
    const result = enhancer.analyze('mesh-1', [
      { from: 'svc-a', to: 'svc-b', latencyMs: 1500, errorRate: 0.01, requestsPerMin: 100 },
    ]);
    expect(result.edgeStatuses[0]!.status).toBe('CRITICAL');
    expect(result.hotspots).toHaveLength(1);
  });

  it('DEGRADED 엣지: latency > 500', () => {
    const result = enhancer.analyze('mesh-2', [
      { from: 'svc-a', to: 'svc-b', latencyMs: 700, errorRate: 0.01, requestsPerMin: 100 },
    ]);
    expect(result.edgeStatuses[0]!.status).toBe('DEGRADED');
    expect(result.hotspots).toHaveLength(0);
  });

  it('HEALTHY 엣지: 임계값 미달', () => {
    const result = enhancer.analyze('mesh-3', [
      { from: 'svc-a', to: 'svc-b', latencyMs: 200, errorRate: 0.01, requestsPerMin: 100 },
    ]);
    expect(result.edgeStatuses[0]!.status).toBe('HEALTHY');
    expect(result.overallScore).toBe(100);
  });

  it('전체 점수 = HEALTHY수/전체수×100', () => {
    const result = enhancer.analyze('mesh-4', [
      { from: 'a', to: 'b', latencyMs: 200, errorRate: 0.01, requestsPerMin: 100 },
      { from: 'b', to: 'c', latencyMs: 1500, errorRate: 0.01, requestsPerMin: 100 },
    ]);
    expect(result.overallScore).toBeCloseTo(50, 1);
  });

  it('errorRate > 0.1 → CRITICAL', () => {
    const result = enhancer.analyze('mesh-5', [
      { from: 'x', to: 'y', latencyMs: 100, errorRate: 0.15, requestsPerMin: 100 },
    ]);
    expect(result.edgeStatuses[0]!.status).toBe('CRITICAL');
  });

  it('빈 엣지 → overallScore 100', () => {
    const result = enhancer.analyze('mesh-6', []);
    expect(result.overallScore).toBe(100);
    expect(result.hotspots).toHaveLength(0);
  });

  it('감사 로그 기록', () => {
    enhancer.analyze('mesh-7', []);
    expect(enhancer.getAuditLog()).toHaveLength(1);
    expect(enhancer.getAuditLog()[0]!.action).toBe('MESH_ANALYZED');
  });
});

// ─── R543: PublicDocumentAuthenticityVerifier ────────────────────────────────

describe('PublicDocumentAuthenticityVerifier', () => {
  let verifier: PublicDocumentAuthenticityVerifier;

  beforeEach(() => {
    verifier = new PublicDocumentAuthenticityVerifier();
  });

  it('AUTHENTIC: 필드완전 + 체크섬유효', () => {
    const result = verifier.verify({
      documentId: 'DOC-001', issuedBy: 'GOV', issuedAt: '2026-04-01',
      checksum: 'a1b2c3d4e5f67890',
      requiredFields: ['name', 'id'], presentFields: ['name', 'id', 'date'],
    });
    expect(result.verdict).toBe('AUTHENTIC');
    expect(result.checksumValid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it('INCOMPLETE: 필수 필드 누락', () => {
    const result = verifier.verify({
      documentId: 'DOC-002', issuedBy: 'GOV', issuedAt: '2026-04-01',
      checksum: 'a1b2c3d4e5f67890',
      requiredFields: ['name', 'id', 'address'], presentFields: ['name'],
    });
    expect(result.verdict).toBe('INCOMPLETE');
    expect(result.missingFields).toContain('id');
    expect(result.missingFields).toContain('address');
  });

  it('TAMPERED: 체크섬 무효 (짧음)', () => {
    const result = verifier.verify({
      documentId: 'DOC-003', issuedBy: 'GOV', issuedAt: '2026-04-01',
      checksum: 'abc123',
      requiredFields: ['name'], presentFields: ['name'],
    });
    expect(result.verdict).toBe('TAMPERED');
    expect(result.checksumValid).toBe(false);
  });

  it('INCOMPLETE가 TAMPERED보다 우선', () => {
    const result = verifier.verify({
      documentId: 'DOC-004', issuedBy: 'GOV', issuedAt: '2026-04-01',
      checksum: 'invalid',
      requiredFields: ['name', 'id'], presentFields: ['name'],
    });
    expect(result.verdict).toBe('INCOMPLETE');
  });

  it('체크섬 비hex 문자 → TAMPERED', () => {
    const result = verifier.verify({
      documentId: 'DOC-005', issuedBy: 'GOV', issuedAt: '2026-04-01',
      checksum: 'ZZZZZZZZZZZZZZZZ',
      requiredFields: ['name'], presentFields: ['name'],
    });
    expect(result.verdict).toBe('TAMPERED');
  });

  it('감사 로그 기록', () => {
    verifier.verify({ documentId: 'DOC-006', issuedBy: 'GOV', issuedAt: '2026-04-01', checksum: 'a1b2c3d4e5f67890', requiredFields: [], presentFields: [] });
    expect(verifier.getAuditLog()).toHaveLength(1);
    expect(verifier.getAuditLog()[0]!.action).toBe('DOCUMENT_VERIFIED');
  });
});

// ─── R544: ApiThrottlingOptimizerAI ──────────────────────────────────────────

describe('ApiThrottlingOptimizerAI', () => {
  let optimizer: ApiThrottlingOptimizerAI;

  beforeEach(() => {
    optimizer = new ApiThrottlingOptimizerAI();
  });

  it('HIGH_USAGE + 낮은 에러율 → 한도 1.5배 증가', () => {
    // usage = 950/1000*100 = 95 > 90, errorRate < 0.01
    const result = optimizer.optimize({ clientId: 'CLI-001', requestsLast1h: 950, currentLimit: 1000, avgResponseMs: 100, errorRate: 0.005 });
    expect(result.status).toBe('HIGH_USAGE');
    expect(result.recommendedLimit).toBe(1500);
  });

  it('HIGH_USAGE + 높은 에러율 → 한도 0.8배 감소', () => {
    const result = optimizer.optimize({ clientId: 'CLI-002', requestsLast1h: 950, currentLimit: 1000, avgResponseMs: 100, errorRate: 0.05 });
    expect(result.recommendedLimit).toBe(800);
  });

  it('LOW_USAGE → 한도 0.7배 감소', () => {
    // usage = 200/1000*100 = 20 < 30
    const result = optimizer.optimize({ clientId: 'CLI-003', requestsLast1h: 200, currentLimit: 1000, avgResponseMs: 100, errorRate: 0.01 });
    expect(result.status).toBe('LOW_USAGE');
    expect(result.recommendedLimit).toBe(700);
  });

  it('NORMAL → 한도 유지', () => {
    // usage = 600/1000*100 = 60
    const result = optimizer.optimize({ clientId: 'CLI-004', requestsLast1h: 600, currentLimit: 1000, avgResponseMs: 100, errorRate: 0.01 });
    expect(result.status).toBe('NORMAL');
    expect(result.recommendedLimit).toBe(1000);
  });

  it('사용률 계산 정확성', () => {
    const result = optimizer.optimize({ clientId: 'CLI-005', requestsLast1h: 500, currentLimit: 1000, avgResponseMs: 100, errorRate: 0.01 });
    expect(result.usageRate).toBeCloseTo(50, 1);
  });

  it('감사 로그 기록', () => {
    optimizer.optimize({ clientId: 'CLI-006', requestsLast1h: 500, currentLimit: 1000, avgResponseMs: 100, errorRate: 0.01 });
    expect(optimizer.getAuditLog()).toHaveLength(1);
    expect(optimizer.getAuditLog()[0]!.action).toBe('THROTTLE_OPTIMIZED');
  });
});

// ─── R545: MultitenantServiceIsolatorV3 ──────────────────────────────────────

describe('MultitenantServiceIsolatorV3', () => {
  let isolator: MultitenantServiceIsolatorV3;

  beforeEach(() => {
    isolator = new MultitenantServiceIsolatorV3();
  });

  it('SAFE: 동일 테넌트 → ALLOW', () => {
    const result = isolator.check({ requestTenantId: 'T1', resourceTenantId: 'T1', resourceType: 'data', action: 'READ', requesterId: 'user-abc' });
    expect(result.riskLevel).toBe('SAFE');
    expect(result.decision).toBe('ALLOW');
  });

  it('CRITICAL: 테넌트 위반 + DELETE → DENY', () => {
    const result = isolator.check({ requestTenantId: 'T1', resourceTenantId: 'T2', resourceType: 'data', action: 'DELETE', requesterId: 'user-abc' });
    expect(result.riskLevel).toBe('CRITICAL');
    expect(result.decision).toBe('DENY');
  });

  it('HIGH: 테넌트 위반 + WRITE → DENY', () => {
    const result = isolator.check({ requestTenantId: 'T1', resourceTenantId: 'T2', resourceType: 'data', action: 'WRITE', requesterId: 'user-abc' });
    expect(result.riskLevel).toBe('HIGH');
    expect(result.decision).toBe('DENY');
  });

  it('MEDIUM: 테넌트 위반 + READ → DENY', () => {
    const result = isolator.check({ requestTenantId: 'T1', resourceTenantId: 'T2', resourceType: 'data', action: 'READ', requesterId: 'user-abc' });
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.decision).toBe('DENY');
  });

  it('PII 마스킹: 4자 이상 → 앞2+***+뒤2', () => {
    const result = isolator.check({ requestTenantId: 'T1', resourceTenantId: 'T1', resourceType: 'data', action: 'READ', requesterId: 'user-abc' });
    expect(result.requesterIdMasked).toBe('us***bc');
  });

  it('PII 마스킹: 4자 미만 → ***', () => {
    const result = isolator.check({ requestTenantId: 'T1', resourceTenantId: 'T1', resourceType: 'data', action: 'READ', requesterId: 'usr' });
    expect(result.requesterIdMasked).toBe('***');
  });

  it('감사 로그 기록', () => {
    isolator.check({ requestTenantId: 'T1', resourceTenantId: 'T1', resourceType: 'data', action: 'READ', requesterId: 'user-abc' });
    expect(isolator.getAuditLog()).toHaveLength(1);
    expect(isolator.getAuditLog()[0]!.action).toBe('ISOLATION_CHECKED');
  });
});

// ─── R546: PublicServiceChannelAnalyzerV3 ────────────────────────────────────

describe('PublicServiceChannelAnalyzerV3', () => {
  let analyzer: PublicServiceChannelAnalyzerV3;

  beforeEach(() => {
    analyzer = new PublicServiceChannelAnalyzerV3();
  });

  it('EXCELLENT 채널: 점수 >= 0.8', () => {
    const result = analyzer.analyze('AGN-001', [
      { channelType: 'web', visitCount: 10000, completionRate: 0.9, avgSatisfaction: 4.5 },
    ]);
    // 0.9*0.5 + (4.5/5)*0.3 + 1*0.2 = 0.45+0.27+0.2 = 0.92
    expect(result.channels[0]!.grade).toBe('EXCELLENT');
  });

  it('GOOD 채널: 점수 0.6~0.79', () => {
    const result = analyzer.analyze('AGN-002', [
      { channelType: 'mobile', visitCount: 5000, completionRate: 0.7, avgSatisfaction: 3.5 },
    ]);
    // 0.7*0.5 + (3.5/5)*0.3 + 0.5*0.2 = 0.35+0.21+0.1 = 0.66
    expect(result.channels[0]!.grade).toBe('GOOD');
  });

  it('FAIR 채널: 점수 0.4~0.59', () => {
    const result = analyzer.analyze('AGN-003', [
      { channelType: 'phone', visitCount: 2000, completionRate: 0.5, avgSatisfaction: 2.5 },
    ]);
    // 0.5*0.5 + (2.5/5)*0.3 + 0.2*0.2 = 0.25+0.15+0.04 = 0.44
    expect(result.channels[0]!.grade).toBe('FAIR');
  });

  it('POOR 채널: 점수 < 0.4', () => {
    const result = analyzer.analyze('AGN-004', [
      { channelType: 'fax', visitCount: 100, completionRate: 0.2, avgSatisfaction: 1.5 },
    ]);
    // 0.2*0.5 + (1.5/5)*0.3 + 0.01*0.2 = 0.1+0.09+0.002 = 0.192
    expect(result.channels[0]!.grade).toBe('POOR');
  });

  it('최우수/최저 채널 식별', () => {
    const result = analyzer.analyze('AGN-005', [
      { channelType: 'web', visitCount: 10000, completionRate: 0.9, avgSatisfaction: 4.5 },
      { channelType: 'fax', visitCount: 100, completionRate: 0.2, avgSatisfaction: 1.5 },
    ]);
    expect(result.bestChannel).toBe('web');
    expect(result.worstChannel).toBe('fax');
  });

  it('visitCount 상한 clamp: min(visits/10000,1)', () => {
    const result = analyzer.analyze('AGN-006', [
      { channelType: 'web', visitCount: 50000, completionRate: 0.9, avgSatisfaction: 4.5 },
    ]);
    // visit contribution은 1.0을 초과하지 않음
    expect(result.channels[0]!.score).toBeCloseTo(0.9 * 0.5 + (4.5 / 5) * 0.3 + 1 * 0.2, 2);
  });

  it('감사 로그 기록', () => {
    analyzer.analyze('AGN-007', [{ channelType: 'web', visitCount: 1000, completionRate: 0.5, avgSatisfaction: 3 }]);
    expect(analyzer.getAuditLog()).toHaveLength(1);
    expect(analyzer.getAuditLog()[0]!.action).toBe('CHANNEL_ANALYZED');
  });
});
