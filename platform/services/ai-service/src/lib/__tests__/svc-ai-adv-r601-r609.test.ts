import { describe, it, expect, beforeEach } from 'vitest';
import { IntelligentNotificationManagerV2 } from '../intelligent-notification-manager-v2';
import { ServiceMeshPolicyOptimizerV2 } from '../service-mesh-policy-optimizer-v2';
import { PublicDataSharingAutomatorV2 } from '../public-data-sharing-automator-v2';
import { RealtimeLoadDistributionOptimizer } from '../realtime-load-distribution-optimizer';
import { InternalAuditReporterV3 } from '../internal-audit-reporter-v3';
import { ServiceQualityAssuranceV3 } from '../service-quality-assurance-v3';
import { AiGovernanceEnhancerV2 } from '../ai-governance-enhancer-v2';
import { CloudResourceAnomalyDetectorV2 } from '../cloud-resource-anomaly-detector-v2';
import { PublicServiceComparisonAnalyzerV2 } from '../public-service-comparison-analyzer-v2';

// ─── R601: IntelligentNotificationManagerV2 ──────────────────────────────────

describe('IntelligentNotificationManagerV2', () => {
  let manager: IntelligentNotificationManagerV2;

  beforeEach(() => {
    manager = new IntelligentNotificationManagerV2();
  });

  it('CRITICAL → SMS+EMAIL (100+수신자보너스)', () => {
    // score = 100 + min(200/100,1)*20 = 120
    const result = manager.process({ notificationId: 'N-001', category: 'sys', severity: 'CRITICAL', recipientCount: 200, isDuplicate: false });
    expect(result.deliveryChannel).toBe('SMS+EMAIL');
    expect(result.isSuppressed).toBe(false);
  });

  it('MEDIUM+중복 → SUPPRESS', () => {
    // score = 40 + 0 - 30 = 10 < 20
    const result = manager.process({ notificationId: 'N-002', category: 'info', severity: 'MEDIUM', recipientCount: 0, isDuplicate: true });
    expect(result.deliveryChannel).toBe('SUPPRESS');
    expect(result.isSuppressed).toBe(true);
  });

  it('HIGH → EMAIL', () => {
    // score = 70 + 0 - 0 = 70 → >=50 EMAIL
    const result = manager.process({ notificationId: 'N-003', category: 'alert', severity: 'HIGH', recipientCount: 0, isDuplicate: false });
    expect(result.deliveryChannel).toBe('EMAIL');
  });

  it('LOW → APP', () => {
    // score = 10 + min(100/100,1)*20 = 30 → >=20 APP
    const result = manager.process({ notificationId: 'N-004', category: 'info', severity: 'LOW', recipientCount: 100, isDuplicate: false });
    expect(result.deliveryChannel).toBe('APP');
  });

  it('수신자 상한 clamp: min(count/100,1)', () => {
    const r1 = manager.process({ notificationId: 'N-005', category: 'sys', severity: 'HIGH', recipientCount: 200, isDuplicate: false });
    const r2 = manager.process({ notificationId: 'N-006', category: 'sys', severity: 'HIGH', recipientCount: 10000, isDuplicate: false });
    // 둘 다 +20 보너스 (1×20)
    expect(r1.priorityScore).toBe(r2.priorityScore);
  });

  it('감사 로그 기록', () => {
    manager.process({ notificationId: 'N-007', category: 'sys', severity: 'LOW', recipientCount: 10, isDuplicate: false });
    expect(manager.getAuditLog()).toHaveLength(1);
    expect(manager.getAuditLog()[0]!.action).toBe('NOTIFICATION_PROCESSED');
  });
});

// ─── R602: ServiceMeshPolicyOptimizerV2 ──────────────────────────────────────

describe('ServiceMeshPolicyOptimizerV2', () => {
  let optimizer: ServiceMeshPolicyOptimizerV2;

  beforeEach(() => {
    optimizer = new ServiceMeshPolicyOptimizerV2();
  });

  it('변경 불필요 정책 → optimizationScore 100', () => {
    const result = optimizer.optimize('mesh-1', [
      { policyId: 'P1', type: 'RETRY', currentValue: 3, recommendedValue: 3, impactScore: 5 },
    ]);
    expect(result.optimizationScore).toBe(100);
    expect(result.changesRequired).toBe(0);
  });

  it('변경 필요 정책 탐지', () => {
    const result = optimizer.optimize('mesh-2', [
      { policyId: 'P1', type: 'TIMEOUT', currentValue: 5000, recommendedValue: 3000, impactScore: 7 },
    ]);
    expect(result.policies[0]!.needsChange).toBe(true);
    expect(result.changesRequired).toBe(1);
  });

  it('위험도: impactScore>=8 → HIGH', () => {
    const result = optimizer.optimize('mesh-3', [
      { policyId: 'P1', type: 'CIRCUIT_BREAKER', currentValue: 5, recommendedValue: 5, impactScore: 9 },
    ]);
    expect(result.policies[0]!.risk).toBe('HIGH');
  });

  it('위험도: impactScore>=5 → MEDIUM', () => {
    const result = optimizer.optimize('mesh-4', [
      { policyId: 'P1', type: 'RATE_LIMIT', currentValue: 100, recommendedValue: 100, impactScore: 6 },
    ]);
    expect(result.policies[0]!.risk).toBe('MEDIUM');
  });

  it('빈 정책 → optimizationScore 100', () => {
    const result = optimizer.optimize('mesh-5', []);
    expect(result.optimizationScore).toBe(100);
  });

  it('감사 로그 기록', () => {
    optimizer.optimize('mesh-6', []);
    expect(optimizer.getAuditLog()).toHaveLength(1);
    expect(optimizer.getAuditLog()[0]!.action).toBe('MESH_POLICY_OPTIMIZED');
  });
});

// ─── R603: PublicDataSharingAutomatorV2 ──────────────────────────────────────

describe('PublicDataSharingAutomatorV2', () => {
  let automator: PublicDataSharingAutomatorV2;

  beforeEach(() => {
    automator = new PublicDataSharingAutomatorV2();
  });

  it('N2SF C등급 → BLOCKED', () => {
    expect(() => automator.process({ requestId: 'R-001', dataGrade: 'C', requesterId: 'user-abc', receiverAgencyId: 'GOV-B', dataCategory: 'personal', hasConsent: true }))
      .toThrow('BLOCKED');
  });

  it('N2SF S등급 → BLOCKED', () => {
    expect(() => automator.process({ requestId: 'R-002', dataGrade: 'S', requesterId: 'user-abc', receiverAgencyId: 'GOV-B', dataCategory: 'security', hasConsent: true }))
      .toThrow('BLOCKED');
  });

  it('O등급 + hasConsent → APPROVED', () => {
    const result = automator.process({ requestId: 'R-003', dataGrade: 'O', requesterId: 'user-abc', receiverAgencyId: 'GOV-B', dataCategory: 'stats', hasConsent: true });
    expect(result.status).toBe('APPROVED');
  });

  it('O등급 + !hasConsent → PENDING_REVIEW', () => {
    const result = automator.process({ requestId: 'R-004', dataGrade: 'O', requesterId: 'user-abc', receiverAgencyId: 'GOV-C', dataCategory: 'stats', hasConsent: false });
    expect(result.status).toBe('PENDING_REVIEW');
  });

  it('requesterId PII 마스킹', () => {
    const result = automator.process({ requestId: 'R-005', dataGrade: 'O', requesterId: 'user-xyz', receiverAgencyId: 'GOV-D', dataCategory: 'stats', hasConsent: true });
    expect(result.requesterIdMasked).toBe('us***yz');
  });

  it('감사 로그 기록', () => {
    automator.process({ requestId: 'R-006', dataGrade: 'O', requesterId: 'user-abc', receiverAgencyId: 'GOV-E', dataCategory: 'stats', hasConsent: true });
    expect(automator.getAuditLog()).toHaveLength(1);
    expect(automator.getAuditLog()[0]!.action).toBe('DATA_SHARING_PROCESSED');
  });
});

// ─── R604: RealtimeLoadDistributionOptimizer ──────────────────────────────────

describe('RealtimeLoadDistributionOptimizer', () => {
  let optimizer: RealtimeLoadDistributionOptimizer;

  beforeEach(() => {
    optimizer = new RealtimeLoadDistributionOptimizer();
  });

  it('OVERLOADED: loadScore >= 80', () => {
    // cpu=90*0.5=45, mem=90*0.3=27, req=1000→min(1,1)*20=20 → 92
    const result = optimizer.analyze('CLS-001', [
      { nodeId: 'N1', cpuUsage: 90, memUsage: 90, requestCount: 1000 },
    ]);
    expect(result.nodes[0]!.status).toBe('OVERLOADED');
  });

  it('NORMAL: loadScore < 60', () => {
    // cpu=20*0.5=10, mem=20*0.3=6, req=0=0 → 16
    const result = optimizer.analyze('CLS-002', [
      { nodeId: 'N1', cpuUsage: 20, memUsage: 20, requestCount: 0 },
    ]);
    expect(result.nodes[0]!.status).toBe('NORMAL');
  });

  it('불균형 탐지: max-min > 30', () => {
    const result = optimizer.analyze('CLS-003', [
      { nodeId: 'N1', cpuUsage: 90, memUsage: 90, requestCount: 1000 },
      { nodeId: 'N2', cpuUsage: 20, memUsage: 20, requestCount: 0 },
    ]);
    expect(result.isImbalanced).toBe(true);
  });

  it('단일 노드 → isImbalanced false', () => {
    const result = optimizer.analyze('CLS-004', [
      { nodeId: 'N1', cpuUsage: 50, memUsage: 50, requestCount: 500 },
    ]);
    expect(result.isImbalanced).toBe(false);
  });

  it('평균 부하 계산', () => {
    const result = optimizer.analyze('CLS-005', [
      { nodeId: 'N1', cpuUsage: 40, memUsage: 40, requestCount: 0 },
      { nodeId: 'N2', cpuUsage: 60, memUsage: 60, requestCount: 0 },
    ]);
    // N1: 40*0.5+40*0.3 = 32, N2: 60*0.5+60*0.3 = 48, avg=40
    expect(result.avgLoad).toBeCloseTo(40, 0);
  });

  it('감사 로그 기록', () => {
    optimizer.analyze('CLS-006', []);
    expect(optimizer.getAuditLog()).toHaveLength(1);
    expect(optimizer.getAuditLog()[0]!.action).toBe('LOAD_DISTRIBUTION_ANALYZED');
  });
});

// ─── R605: InternalAuditReporterV3 ───────────────────────────────────────────

describe('InternalAuditReporterV3', () => {
  let reporter: InternalAuditReporterV3;

  beforeEach(() => {
    reporter = new InternalAuditReporterV3();
  });

  it('isRecurring → 심각도 상향', () => {
    const result = reporter.report('AUD-001', 'GOV-A', [
      { findingId: 'F1', category: 'access', severity: 'LOW', isRecurring: true },
    ]);
    expect(result.findings[0]!.weightedSeverity).toBe('MEDIUM');
  });

  it('CRITICAL은 상향 없음', () => {
    const result = reporter.report('AUD-002', 'GOV-A', [
      { findingId: 'F1', category: 'data', severity: 'CRITICAL', isRecurring: true },
    ]);
    expect(result.findings[0]!.weightedSeverity).toBe('CRITICAL');
  });

  it('즉시 시정 필요: CRITICAL/HIGH', () => {
    const result = reporter.report('AUD-003', 'GOV-B', [
      { findingId: 'F1', category: 'sec', severity: 'HIGH', isRecurring: false },
      { findingId: 'F2', category: 'access', severity: 'LOW', isRecurring: false },
    ]);
    expect(result.immediateCount).toBe(1);
    expect(result.findings[0]!.requiresImmediate).toBe(true);
    expect(result.findings[1]!.requiresImmediate).toBe(false);
  });

  it('감사 점수 = (1 - immediate/total) * 100', () => {
    const result = reporter.report('AUD-004', 'GOV-C', [
      { findingId: 'F1', category: 'sec', severity: 'HIGH', isRecurring: false },
      { findingId: 'F2', category: 'access', severity: 'LOW', isRecurring: false },
    ]);
    // 1/2=0.5 → score=50
    expect(result.auditScore).toBeCloseTo(50, 0);
  });

  it('빈 findings → 감사 점수 100', () => {
    const result = reporter.report('AUD-005', 'GOV-D', []);
    expect(result.auditScore).toBe(100);
  });

  it('감사 로그 기록', () => {
    reporter.report('AUD-006', 'GOV-E', []);
    expect(reporter.getAuditLog()).toHaveLength(1);
    expect(reporter.getAuditLog()[0]!.action).toBe('AUDIT_REPORTED');
  });
});

// ─── R606: ServiceQualityAssuranceV3 ─────────────────────────────────────────

describe('ServiceQualityAssuranceV3', () => {
  let qa: ServiceQualityAssuranceV3;

  beforeEach(() => {
    qa = new ServiceQualityAssuranceV3();
  });

  it('3개 위반 → CRITICAL + 에스컬레이션', () => {
    const result = qa.assess({ serviceId: 'SVC-001', availability: 0.9, responseTimeMs: 2000, errorRate: 0.1, slaAvailability: 0.99, slaResponseTimeMs: 1000, slaErrorRate: 0.05 });
    expect(result.severity).toBe('CRITICAL');
    expect(result.requiresEscalation).toBe(true);
    expect(result.violationCount).toBe(3);
  });

  it('2개 위반 → HIGH', () => {
    const result = qa.assess({ serviceId: 'SVC-002', availability: 0.9, responseTimeMs: 2000, errorRate: 0.01, slaAvailability: 0.99, slaResponseTimeMs: 1000, slaErrorRate: 0.05 });
    expect(result.severity).toBe('HIGH');
  });

  it('1개 위반 → MEDIUM', () => {
    const result = qa.assess({ serviceId: 'SVC-003', availability: 0.99, responseTimeMs: 1500, errorRate: 0.01, slaAvailability: 0.99, slaResponseTimeMs: 1000, slaErrorRate: 0.05 });
    expect(result.severity).toBe('MEDIUM');
  });

  it('0개 위반 → OK', () => {
    const result = qa.assess({ serviceId: 'SVC-004', availability: 0.999, responseTimeMs: 500, errorRate: 0.001, slaAvailability: 0.99, slaResponseTimeMs: 1000, slaErrorRate: 0.05 });
    expect(result.severity).toBe('OK');
    expect(result.requiresEscalation).toBe(false);
  });

  it('위반 항목 목록 반환', () => {
    const result = qa.assess({ serviceId: 'SVC-005', availability: 0.9, responseTimeMs: 500, errorRate: 0.01, slaAvailability: 0.99, slaResponseTimeMs: 1000, slaErrorRate: 0.05 });
    expect(result.violations[0]!.metric).toBe('availability');
  });

  it('감사 로그 기록', () => {
    qa.assess({ serviceId: 'SVC-006', availability: 0.999, responseTimeMs: 500, errorRate: 0.001, slaAvailability: 0.99, slaResponseTimeMs: 1000, slaErrorRate: 0.05 });
    expect(qa.getAuditLog()).toHaveLength(1);
    expect(qa.getAuditLog()[0]!.action).toBe('SLA_ASSESSED');
  });
});

// ─── R607: AiGovernanceEnhancerV2 ─────────────────────────────────────────────

describe('AiGovernanceEnhancerV2', () => {
  let enhancer: AiGovernanceEnhancerV2;

  beforeEach(() => {
    enhancer = new AiGovernanceEnhancerV2();
  });

  it('COMPLIANT: 4개 모두 true', () => {
    const result = enhancer.evaluate({ systemId: 'SYS-001', hasExplainability: true, hasBiasCheck: true, hasAuditLog: true, hasHumanOversight: true, dataGrade: 'O' });
    expect(result.grade).toBe('COMPLIANT');
    expect(result.governanceScore).toBe(100);
  });

  it('PARTIAL: 2~3개', () => {
    const result = enhancer.evaluate({ systemId: 'SYS-002', hasExplainability: true, hasBiasCheck: true, hasAuditLog: false, hasHumanOversight: false, dataGrade: 'O' });
    expect(result.grade).toBe('PARTIAL');
    expect(result.governanceScore).toBe(50);
  });

  it('NON_COMPLIANT: 1개 이하', () => {
    const result = enhancer.evaluate({ systemId: 'SYS-003', hasExplainability: true, hasBiasCheck: false, hasAuditLog: false, hasHumanOversight: false, dataGrade: 'O' });
    expect(result.grade).toBe('NON_COMPLIANT');
  });

  it('VIOLATION: C등급 + 감독 없음', () => {
    const result = enhancer.evaluate({ systemId: 'SYS-004', hasExplainability: true, hasBiasCheck: true, hasAuditLog: true, hasHumanOversight: false, dataGrade: 'C' });
    expect(result.hasViolation).toBe(true);
    expect(result.violationReason).not.toBeNull();
  });

  it('O등급 → VIOLATION 없음', () => {
    const result = enhancer.evaluate({ systemId: 'SYS-005', hasExplainability: false, hasBiasCheck: false, hasAuditLog: true, hasHumanOversight: false, dataGrade: 'O' });
    expect(result.hasViolation).toBe(false);
  });

  it('감사 로그 기록', () => {
    enhancer.evaluate({ systemId: 'SYS-006', hasExplainability: true, hasBiasCheck: true, hasAuditLog: true, hasHumanOversight: true, dataGrade: 'O' });
    expect(enhancer.getAuditLog()).toHaveLength(1);
    expect(enhancer.getAuditLog()[0]!.action).toBe('GOVERNANCE_EVALUATED');
  });
});

// ─── R608: CloudResourceAnomalyDetectorV2 ────────────────────────────────────

describe('CloudResourceAnomalyDetectorV2', () => {
  let detector: CloudResourceAnomalyDetectorV2;

  beforeEach(() => {
    detector = new CloudResourceAnomalyDetectorV2();
  });

  it('DATA_EXFIL: networkEgressGB > 100 → CRITICAL', () => {
    const result = detector.detect('ACC-001', [
      { resourceId: 'R1', type: 'vm', cpuUsage: 50, networkEgressGB: 150, unusualAccessCount: 10 },
    ]);
    expect(result.resources[0]!.anomalyType).toBe('DATA_EXFIL');
    expect(result.resources[0]!.severity).toBe('CRITICAL');
    expect(result.requiresImmediateAction).toBe(true);
  });

  it('INTRUSION: unusualAccessCount > 50 → CRITICAL', () => {
    const result = detector.detect('ACC-002', [
      { resourceId: 'R1', type: 'db', cpuUsage: 50, networkEgressGB: 10, unusualAccessCount: 60 },
    ]);
    expect(result.resources[0]!.anomalyType).toBe('INTRUSION');
  });

  it('CPU_SPIKE: cpuUsage > 95 → HIGH', () => {
    const result = detector.detect('ACC-003', [
      { resourceId: 'R1', type: 'vm', cpuUsage: 98, networkEgressGB: 5, unusualAccessCount: 5 },
    ]);
    expect(result.resources[0]!.anomalyType).toBe('CPU_SPIKE');
    expect(result.resources[0]!.severity).toBe('HIGH');
  });

  it('NORMAL: 모든 임계값 미달 → OK', () => {
    const result = detector.detect('ACC-004', [
      { resourceId: 'R1', type: 'vm', cpuUsage: 50, networkEgressGB: 10, unusualAccessCount: 5 },
    ]);
    expect(result.resources[0]!.anomalyType).toBe('NORMAL');
    expect(result.requiresImmediateAction).toBe(false);
  });

  it('DATA_EXFIL 우선순위: egress>100 이면 cpu>95도 DATA_EXFIL', () => {
    const result = detector.detect('ACC-005', [
      { resourceId: 'R1', type: 'vm', cpuUsage: 98, networkEgressGB: 150, unusualAccessCount: 60 },
    ]);
    expect(result.resources[0]!.anomalyType).toBe('DATA_EXFIL');
  });

  it('감사 로그 기록', () => {
    detector.detect('ACC-006', []);
    expect(detector.getAuditLog()).toHaveLength(1);
    expect(detector.getAuditLog()[0]!.action).toBe('CLOUD_RESOURCE_ANOMALY_DETECTED');
  });
});

// ─── R609: PublicServiceComparisonAnalyzerV2 ──────────────────────────────────

describe('PublicServiceComparisonAnalyzerV2', () => {
  let analyzer: PublicServiceComparisonAnalyzerV2;

  beforeEach(() => {
    analyzer = new PublicServiceComparisonAnalyzerV2();
  });

  it('EXCELLENT: 종합 점수 >= 80', () => {
    // usage=10000→1*100*0.3=30, sat=5→100*0.3=30, cost=90*0.2=18, access=90*0.2=18 = 96
    const result = analyzer.analyze('ANL-001', [
      { serviceId: 'SVC-A', usageCount: 10000, satisfactionScore: 5, costEfficiency: 90, accessibilityScore: 90 },
    ]);
    expect(result.services[0]!.grade).toBe('EXCELLENT');
  });

  it('POOR: 종합 점수 < 40', () => {
    // usage=100→0.01*100*0.3=0.3, sat=1→20*0.3=6, cost=10*0.2=2, access=10*0.2=2 = 10.3
    const result = analyzer.analyze('ANL-002', [
      { serviceId: 'SVC-B', usageCount: 100, satisfactionScore: 1, costEfficiency: 10, accessibilityScore: 10 },
    ]);
    expect(result.services[0]!.grade).toBe('POOR');
  });

  it('topService/bottomService 식별', () => {
    const result = analyzer.analyze('ANL-003', [
      { serviceId: 'SVC-A', usageCount: 10000, satisfactionScore: 5, costEfficiency: 90, accessibilityScore: 90 },
      { serviceId: 'SVC-B', usageCount: 100, satisfactionScore: 1, costEfficiency: 10, accessibilityScore: 10 },
    ]);
    expect(result.topService).toBe('SVC-A');
    expect(result.bottomService).toBe('SVC-B');
  });

  it('평균 점수 계산', () => {
    const result = analyzer.analyze('ANL-004', [
      { serviceId: 'SVC-A', usageCount: 5000, satisfactionScore: 3, costEfficiency: 50, accessibilityScore: 50 },
      { serviceId: 'SVC-B', usageCount: 5000, satisfactionScore: 3, costEfficiency: 50, accessibilityScore: 50 },
    ]);
    // 두 서비스 동점: 5000/10000*100*0.3+3/5*100*0.3+50*0.2+50*0.2 = 15+18+10+10 = 53
    expect(result.avgScore).toBeCloseTo(53, 0);
  });

  it('usageCount 상한 clamp: min(count/10000,1)', () => {
    const result = analyzer.analyze('ANL-005', [
      { serviceId: 'SVC-A', usageCount: 50000, satisfactionScore: 3, costEfficiency: 50, accessibilityScore: 50 },
    ]);
    // min(50000/10000,1)=1 → 1*100*0.3=30 (cap 적용)
    expect(result.services[0]!.score).toBeCloseTo(1 * 100 * 0.3 + (3 / 5) * 100 * 0.3 + 50 * 0.2 + 50 * 0.2, 1);
  });

  it('감사 로그 기록', () => {
    analyzer.analyze('ANL-006', []);
    expect(analyzer.getAuditLog()).toHaveLength(1);
    expect(analyzer.getAuditLog()[0]!.action).toBe('SERVICE_COMPARISON_ANALYZED');
  });
});
