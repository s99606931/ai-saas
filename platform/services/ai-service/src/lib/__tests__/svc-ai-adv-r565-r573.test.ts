import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionAutomationAIV2 } from '../decision-automation-ai-v2';
import { ApiUsageForecasterV3 } from '../api-usage-forecaster-v3';
import { InfoAssetManagerAI } from '../info-asset-manager-ai';
import { RealtimeServiceQualityPredictorV2 } from '../realtime-service-quality-predictor-v2';
import { PublicProcurementAutomationV2 } from '../public-procurement-automation-v2';
import { SecurityVulnerabilityScannerV3 } from '../security-vulnerability-scanner-v3';
import { PublicServiceRecommenderV3 } from '../public-service-recommender-v3';
import { MulticloudNetworkOptimizerV2 } from '../multicloud-network-optimizer-v2';
import { ServiceCostAnomalyDetectorV4 } from '../service-cost-anomaly-detector-v4';

// ─── R565: DecisionAutomationAIV2 ────────────────────────────────────────────

describe('DecisionAutomationAIV2', () => {
  let automator: DecisionAutomationAIV2;

  beforeEach(() => {
    automator = new DecisionAutomationAIV2();
  });

  it('AUTO: 소액+상위등급+첨부파일', () => {
    const result = automator.process({
      requestId: 'REQ-001', category: 'office', amount: 500_000,
      requesterGrade: '5', urgency: 'LOW', hasAttachments: true,
    });
    expect(result.canAutoApprove).toBe(true);
    expect(result.approvalRoute).toBe('AUTO');
    expect(result.estimatedDays).toBe(0);
  });

  it('FAST_TRACK: 자동결재 불가 + HIGH 긴급도', () => {
    const result = automator.process({
      requestId: 'REQ-002', category: 'it', amount: 2_000_000,
      requesterGrade: '5', urgency: 'HIGH', hasAttachments: true,
    });
    expect(result.canAutoApprove).toBe(false);
    expect(result.approvalRoute).toBe('FAST_TRACK');
    expect(result.estimatedDays).toBe(1);
  });

  it('STANDARD: 자동결재 불가 + 낮은 긴급도', () => {
    const result = automator.process({
      requestId: 'REQ-003', category: 'travel', amount: 2_000_000,
      requesterGrade: '5', urgency: 'LOW', hasAttachments: true,
    });
    expect(result.approvalRoute).toBe('STANDARD');
    expect(result.estimatedDays).toBe(3);
  });

  it('자동결재 불가: 첨부파일 없음', () => {
    const result = automator.process({
      requestId: 'REQ-004', category: 'supplies', amount: 500_000,
      requesterGrade: '5', urgency: 'LOW', hasAttachments: false,
    });
    expect(result.canAutoApprove).toBe(false);
  });

  it('자동결재 불가: 등급 미달 (2 < 3)', () => {
    const result = automator.process({
      requestId: 'REQ-005', category: 'supplies', amount: 500_000,
      requesterGrade: '2', urgency: 'LOW', hasAttachments: true,
    });
    expect(result.canAutoApprove).toBe(false);
  });

  it('감사 로그 기록', () => {
    automator.process({ requestId: 'REQ-006', category: 'office', amount: 100_000, requesterGrade: '4', urgency: 'LOW', hasAttachments: true });
    expect(automator.getAuditLog()).toHaveLength(1);
    expect(automator.getAuditLog()[0]!.action).toBe('DECISION_PROCESSED');
  });
});

// ─── R566: ApiUsageForecasterV3 ──────────────────────────────────────────────

describe('ApiUsageForecasterV3', () => {
  let forecaster: ApiUsageForecasterV3;

  beforeEach(() => {
    forecaster = new ApiUsageForecasterV3();
  });

  it('예측 사용량과 용량 권고 계산', () => {
    // growthRate = (1200-1000)/(3-1)/1000 = 0.1, forecast = ceil(1200*(1.1)^1) = ceil(1320) = 1320
    const result = forecaster.forecast({ apiId: 'API-001', dailyUsage: [1000, 1100, 1200], forecastDays: 1 });
    expect(result.forecastedUsage).toBe(1320);
    expect(result.recommendedCapacity).toBe(Math.ceil(1320 * 1.3));
  });

  it('증가율 0일 때 예측 = 마지막 값', () => {
    const result = forecaster.forecast({ apiId: 'API-002', dailyUsage: [1000, 1000, 1000], forecastDays: 5 });
    expect(result.forecastedUsage).toBe(1000);
    expect(result.avgDailyGrowthRate).toBe(0);
  });

  it('3개 미만 데이터 → 에러', () => {
    expect(() => forecaster.forecast({ apiId: 'API-003', dailyUsage: [100, 200], forecastDays: 1 }))
      .toThrow('insufficient data');
  });

  it('용량 권고 = ceil(forecast * 1.3)', () => {
    const result = forecaster.forecast({ apiId: 'API-004', dailyUsage: [100, 110, 121], forecastDays: 1 });
    expect(result.recommendedCapacity).toBe(Math.ceil(result.forecastedUsage * 1.3));
  });

  it('감사 로그 기록', () => {
    forecaster.forecast({ apiId: 'API-005', dailyUsage: [100, 110, 120], forecastDays: 1 });
    expect(forecaster.getAuditLog()).toHaveLength(1);
    expect(forecaster.getAuditLog()[0]!.action).toBe('API_USAGE_FORECASTED');
  });
});

// ─── R567: InfoAssetManagerAI ─────────────────────────────────────────────────

describe('InfoAssetManagerAI', () => {
  let manager: InfoAssetManagerAI;

  beforeEach(() => {
    manager = new InfoAssetManagerAI();
  });

  it('CRITICAL: C등급 + 높은 노출 + 오랜 미감사', () => {
    // 40 + 10*3 + 1*30 = 100
    const result = manager.assess({ assetId: 'AST-001', assetName: '개인정보DB', dataGrade: 'C', exposureLevel: 10, lastAuditDays: 365 });
    expect(result.riskGrade).toBe('CRITICAL');
    expect(result.recommendedAction).toBe('IMMEDIATE_AUDIT');
  });

  it('HIGH: S등급 + 중간 노출', () => {
    // 30 + 7*3 + 0.5*30 = 30+21+15 = 66 → >=50 HIGH
    const result = manager.assess({ assetId: 'AST-002', assetName: '행정DB', dataGrade: 'S', exposureLevel: 7, lastAuditDays: 183 });
    expect(result.riskGrade).toBe('HIGH');
    expect(result.recommendedAction).toBe('SCHEDULE_AUDIT');
  });

  it('MEDIUM: O등급 + 낮은 노출', () => {
    // 10 + 5*3 + 0.1*30 = 10+15+3 = 28 → MEDIUM? 28<30 → LOW
    // 10 + 6*3 + 0.1*30 = 10+18+3 = 31 → MEDIUM
    const result = manager.assess({ assetId: 'AST-003', assetName: '공개데이터', dataGrade: 'O', exposureLevel: 6, lastAuditDays: 37 });
    expect(result.riskGrade).toBe('MEDIUM');
    expect(result.recommendedAction).toBe('MONITOR');
  });

  it('LOW: O등급 + 최소 노출 + 최근 감사', () => {
    // 10 + 0*3 + 0*30 = 10 → LOW
    const result = manager.assess({ assetId: 'AST-004', assetName: '통계자료', dataGrade: 'O', exposureLevel: 0, lastAuditDays: 0 });
    expect(result.riskGrade).toBe('LOW');
    expect(result.recommendedAction).toBe('ROUTINE');
  });

  it('lastAuditDays 상한 clamp: min(days/365,1)', () => {
    const r1 = manager.assess({ assetId: 'AST-005', assetName: 'X', dataGrade: 'O', exposureLevel: 0, lastAuditDays: 730 });
    const r2 = manager.assess({ assetId: 'AST-006', assetName: 'X', dataGrade: 'O', exposureLevel: 0, lastAuditDays: 365 });
    // 둘 다 min(...,1)=1이므로 동점
    expect(r1.riskScore).toBe(r2.riskScore);
  });

  it('감사 로그 기록', () => {
    manager.assess({ assetId: 'AST-007', assetName: 'Y', dataGrade: 'O', exposureLevel: 0, lastAuditDays: 0 });
    expect(manager.getAuditLog()).toHaveLength(1);
    expect(manager.getAuditLog()[0]!.action).toBe('ASSET_ASSESSED');
  });
});

// ─── R568: RealtimeServiceQualityPredictorV2 ─────────────────────────────────

describe('RealtimeServiceQualityPredictorV2', () => {
  let predictor: RealtimeServiceQualityPredictorV2;

  beforeEach(() => {
    predictor = new RealtimeServiceQualityPredictorV2();
  });

  it('CRITICAL: CPU위험 + 메모리위험', () => {
    const result = predictor.predict({
      serviceId: 'SVC-001', cpuTrend: [80, 85, 90], memTrend: [85, 88, 92],
      currentErrorRate: 0.01, slaTarget: 0.05,
    });
    expect(result.cpuRisk).toBe(true);
    expect(result.memRisk).toBe(true);
    expect(result.prediction).toBe('CRITICAL');
  });

  it('WARNING: CPU위험만', () => {
    const result = predictor.predict({
      serviceId: 'SVC-002', cpuTrend: [75, 80, 85], memTrend: [50, 55, 60],
      currentErrorRate: 0.01, slaTarget: 0.05,
    });
    expect(result.cpuRisk).toBe(true);
    expect(result.memRisk).toBe(false);
    expect(result.prediction).toBe('WARNING');
  });

  it('WARNING: errorRate > slaTarget', () => {
    const result = predictor.predict({
      serviceId: 'SVC-003', cpuTrend: [30, 35, 40], memTrend: [40, 45, 50],
      currentErrorRate: 0.1, slaTarget: 0.05,
    });
    expect(result.prediction).toBe('WARNING');
  });

  it('STABLE: 모든 지표 정상', () => {
    const result = predictor.predict({
      serviceId: 'SVC-004', cpuTrend: [30, 35, 40], memTrend: [40, 45, 50],
      currentErrorRate: 0.01, slaTarget: 0.05,
    });
    expect(result.prediction).toBe('STABLE');
  });

  it('마지막 3개 평균 사용', () => {
    // 긴 배열: 마지막 3개만 사용해야 함
    const result = predictor.predict({
      serviceId: 'SVC-005', cpuTrend: [10, 10, 10, 10, 80, 85, 90],
      memTrend: [10, 10, 10, 10, 10, 10, 10],
      currentErrorRate: 0.01, slaTarget: 0.05,
    });
    expect(result.cpuRisk).toBe(true);
  });

  it('감사 로그 기록', () => {
    predictor.predict({ serviceId: 'SVC-006', cpuTrend: [10, 20, 30], memTrend: [10, 20, 30], currentErrorRate: 0.01, slaTarget: 0.05 });
    expect(predictor.getAuditLog()).toHaveLength(1);
    expect(predictor.getAuditLog()[0]!.action).toBe('QUALITY_PREDICTED');
  });
});

// ─── R569: PublicProcurementAutomationV2 ─────────────────────────────────────

describe('PublicProcurementAutomationV2', () => {
  let procurement: PublicProcurementAutomationV2;

  beforeEach(() => {
    procurement = new PublicProcurementAutomationV2();
  });

  it('EMERGENCY_PURCHASE: 긴급 조달', () => {
    const result = procurement.process({
      procurementId: 'PRC-001', itemCategory: 'IT', estimatedAmount: 5_000_000,
      vendorCount: 3, isEmergency: true, budgetAvailable: 100_000_000,
    });
    expect(result.procurementMethod).toBe('EMERGENCY_PURCHASE');
    expect(result.canAutoApprove).toBe(false);
  });

  it('OPEN_BID: 5천만 초과', () => {
    const result = procurement.process({
      procurementId: 'PRC-002', itemCategory: 'construction', estimatedAmount: 60_000_000,
      vendorCount: 5, isEmergency: false, budgetAvailable: 200_000_000,
    });
    expect(result.procurementMethod).toBe('OPEN_BID');
  });

  it('LIMITED_BID: 1천만 초과~5천만', () => {
    const result = procurement.process({
      procurementId: 'PRC-003', itemCategory: 'software', estimatedAmount: 20_000_000,
      vendorCount: 3, isEmergency: false, budgetAvailable: 100_000_000,
    });
    expect(result.procurementMethod).toBe('LIMITED_BID');
  });

  it('DIRECT_CONTRACT: 1천만 이하', () => {
    const result = procurement.process({
      procurementId: 'PRC-004', itemCategory: 'supplies', estimatedAmount: 5_000_000,
      vendorCount: 3, isEmergency: false, budgetAvailable: 100_000_000,
    });
    expect(result.procurementMethod).toBe('DIRECT_CONTRACT');
  });

  it('자동 승인: 예산10%이내+업체3+비긴급', () => {
    const result = procurement.process({
      procurementId: 'PRC-005', itemCategory: 'office', estimatedAmount: 5_000_000,
      vendorCount: 3, isEmergency: false, budgetAvailable: 100_000_000,
    });
    expect(result.canAutoApprove).toBe(true);
  });

  it('예산 여유율 계산', () => {
    const result = procurement.process({
      procurementId: 'PRC-006', itemCategory: 'office', estimatedAmount: 20_000_000,
      vendorCount: 3, isEmergency: false, budgetAvailable: 100_000_000,
    });
    // (100M-20M)/100M*100 = 80.0
    expect(result.budgetMarginRate).toBeCloseTo(80, 0);
  });

  it('감사 로그 기록', () => {
    procurement.process({ procurementId: 'PRC-007', itemCategory: 'X', estimatedAmount: 1000, vendorCount: 3, isEmergency: false, budgetAvailable: 100_000 });
    expect(procurement.getAuditLog()).toHaveLength(1);
  });
});

// ─── R570: SecurityVulnerabilityScannerV3 ────────────────────────────────────

describe('SecurityVulnerabilityScannerV3', () => {
  let scanner: SecurityVulnerabilityScannerV3;

  beforeEach(() => {
    scanner = new SecurityVulnerabilityScannerV3();
  });

  it('CRITICAL: cvssScore >= 9 → 즉시 패치', () => {
    const result = scanner.scan('SCAN-001', 'server-a', [
      { cveId: 'CVE-001', cvssScore: 9.5, isExploited: false, affectedComponent: 'openssl' },
    ]);
    expect(result.vulnDetails[0]!.severity).toBe('CRITICAL');
    expect(result.vulnDetails[0]!.requiresImmediatePatch).toBe(true);
    expect(result.criticalCount).toBe(1);
  });

  it('isExploited → 즉시 패치 (점수 무관)', () => {
    const result = scanner.scan('SCAN-002', 'server-b', [
      { cveId: 'CVE-002', cvssScore: 5.0, isExploited: true, affectedComponent: 'nginx' },
    ]);
    expect(result.vulnDetails[0]!.requiresImmediatePatch).toBe(true);
    expect(result.immediatePatches).toContain('CVE-002');
  });

  it('HIGH: cvssScore 7~8.9', () => {
    const result = scanner.scan('SCAN-003', 'server-c', [
      { cveId: 'CVE-003', cvssScore: 7.5, isExploited: false, affectedComponent: 'apache' },
    ]);
    expect(result.vulnDetails[0]!.severity).toBe('HIGH');
    expect(result.highCount).toBe(1);
  });

  it('MEDIUM: cvssScore 4~6.9', () => {
    const result = scanner.scan('SCAN-004', 'server-d', [
      { cveId: 'CVE-004', cvssScore: 5.0, isExploited: false, affectedComponent: 'log4j' },
    ]);
    expect(result.vulnDetails[0]!.severity).toBe('MEDIUM');
  });

  it('LOW: cvssScore < 4', () => {
    const result = scanner.scan('SCAN-005', 'server-e', [
      { cveId: 'CVE-005', cvssScore: 2.0, isExploited: false, affectedComponent: 'curl' },
    ]);
    expect(result.vulnDetails[0]!.severity).toBe('LOW');
    expect(result.immediatePatches).toHaveLength(0);
  });

  it('감사 로그 기록', () => {
    scanner.scan('SCAN-006', 'server-f', []);
    expect(scanner.getAuditLog()).toHaveLength(1);
    expect(scanner.getAuditLog()[0]!.action).toBe('VULNERABILITY_SCANNED');
  });
});

// ─── R571: PublicServiceRecommenderV3 ────────────────────────────────────────

describe('PublicServiceRecommenderV3', () => {
  let recommender: PublicServiceRecommenderV3;

  const services = [
    { serviceId: 'SVC-A', category: 'welfare', region: 'Seoul', ageGroups: ['20s', '30s'] },
    { serviceId: 'SVC-B', category: 'education', region: 'ALL', ageGroups: ['10s', '20s'] },
    { serviceId: 'SVC-C', category: 'welfare', region: 'Busan', ageGroups: ['20s'] },
  ];

  beforeEach(() => {
    recommender = new PublicServiceRecommenderV3();
  });

  it('N2SF C등급 → BLOCKED', () => {
    expect(() => recommender.recommend({
      userId: 'user-001', dataGrade: 'C', ageGroup: '20s', region: 'Seoul',
      requestedCategories: ['welfare'], availableServices: services,
    })).toThrow('BLOCKED');
  });

  it('N2SF S등급 → BLOCKED', () => {
    expect(() => recommender.recommend({
      userId: 'user-002', dataGrade: 'S', ageGroup: '20s', region: 'Seoul',
      requestedCategories: ['welfare'], availableServices: services,
    })).toThrow('BLOCKED');
  });

  it('O등급: 카테고리+지역+나이 매칭', () => {
    const result = recommender.recommend({
      userId: 'user-003', dataGrade: 'O', ageGroup: '20s', region: 'Seoul',
      requestedCategories: ['welfare'], availableServices: services,
    });
    // SVC-A: welfare, Seoul, 20s OK / SVC-C: Busan X
    expect(result.recommendedServices).toContain('SVC-A');
    expect(result.recommendedServices).not.toContain('SVC-C');
  });

  it('region=ALL 서비스 포함', () => {
    const result = recommender.recommend({
      userId: 'user-004', dataGrade: 'O', ageGroup: '20s', region: 'Incheon',
      requestedCategories: ['education'], availableServices: services,
    });
    expect(result.recommendedServices).toContain('SVC-B');
  });

  it('userId 마스킹 적용', () => {
    const result = recommender.recommend({
      userId: 'user-123', dataGrade: 'O', ageGroup: '20s', region: 'Seoul',
      requestedCategories: ['welfare'], availableServices: services,
    });
    expect(result.userIdMasked).toBe('us***23');
  });

  it('4자 미만 userId → ***', () => {
    const result = recommender.recommend({
      userId: 'usr', dataGrade: 'O', ageGroup: '20s', region: 'Seoul',
      requestedCategories: [], availableServices: [],
    });
    expect(result.userIdMasked).toBe('***');
  });

  it('감사 로그 기록', () => {
    recommender.recommend({ userId: 'user-abc', dataGrade: 'O', ageGroup: '20s', region: 'Seoul', requestedCategories: [], availableServices: [] });
    expect(recommender.getAuditLog()).toHaveLength(1);
    expect(recommender.getAuditLog()[0]!.action).toBe('SERVICE_RECOMMENDED');
  });
});

// ─── R572: MulticloudNetworkOptimizerV2 ──────────────────────────────────────

describe('MulticloudNetworkOptimizerV2', () => {
  let optimizer: MulticloudNetworkOptimizerV2;

  beforeEach(() => {
    optimizer = new MulticloudNetworkOptimizerV2();
  });

  it('OPTIMAL: 낮은 지연+낮은 비용+높은 대역폭', () => {
    const result = optimizer.optimize('NET-001', [
      { from: 'aws', to: 'gcp', latencyMs: 100, costPerGB: 1, bandwidthMbps: 1000 },
    ]);
    // (1-0.1)*0.5 + (1-0.1)*0.3 + 1*0.2 = 0.45+0.27+0.2 = 0.92
    expect(result.links[0]!.status).toBe('OPTIMAL');
  });

  it('BOTTLENECK: 높은 지연+높은 비용+낮은 대역폭', () => {
    const result = optimizer.optimize('NET-002', [
      { from: 'aws', to: 'azure', latencyMs: 2000, costPerGB: 15, bandwidthMbps: 10 },
    ]);
    // (1-1)*0.5 + (1-1)*0.3 + 0.01*0.2 = 0+0+0.002 ≈ 0.002
    expect(result.links[0]!.status).toBe('BOTTLENECK');
    expect(result.bottlenecks).toHaveLength(1);
  });

  it('bestLink: 점수 최고 링크', () => {
    const result = optimizer.optimize('NET-003', [
      { from: 'aws', to: 'gcp', latencyMs: 100, costPerGB: 1, bandwidthMbps: 1000 },
      { from: 'gcp', to: 'azure', latencyMs: 800, costPerGB: 8, bandwidthMbps: 100 },
    ]);
    expect(result.bestLink.from).toBe('aws');
    expect(result.bestLink.to).toBe('gcp');
  });

  it('빈 링크 → bestLink 빈 문자열', () => {
    const result = optimizer.optimize('NET-004', []);
    expect(result.bestLink.from).toBe('');
    expect(result.bottlenecks).toHaveLength(0);
  });

  it('ACCEPTABLE: 중간 점수', () => {
    // latency=500: (1-0.5)*0.5=0.25, cost=5: (1-0.5)*0.3=0.15, bw=500: 0.5*0.2=0.1 → 0.5
    const result = optimizer.optimize('NET-005', [
      { from: 'dc1', to: 'dc2', latencyMs: 500, costPerGB: 5, bandwidthMbps: 500 },
    ]);
    expect(result.links[0]!.status).toBe('ACCEPTABLE');
  });

  it('감사 로그 기록', () => {
    optimizer.optimize('NET-006', []);
    expect(optimizer.getAuditLog()).toHaveLength(1);
    expect(optimizer.getAuditLog()[0]!.action).toBe('NETWORK_OPTIMIZED');
  });
});

// ─── R573: ServiceCostAnomalyDetectorV4 ──────────────────────────────────────

describe('ServiceCostAnomalyDetectorV4', () => {
  let detector: ServiceCostAnomalyDetectorV4;

  beforeEach(() => {
    detector = new ServiceCostAnomalyDetectorV4();
  });

  it('CRITICAL: 이상 비율 > 50%', () => {
    const result = detector.detect('TENANT-001', [
      { serviceId: 'SVC-A', currentCost: 200, baseline: 100, category: 'compute' },
      { serviceId: 'SVC-B', currentCost: 200, baseline: 100, category: 'storage' },
      { serviceId: 'SVC-C', currentCost: 100, baseline: 100, category: 'network' },
    ]);
    // 2/3 = 0.67 > 0.5
    expect(result.overallStatus).toBe('CRITICAL');
    expect(result.anomalyCount).toBe(2);
  });

  it('WARNING: 이상 비율 > 20%~50%', () => {
    const result = detector.detect('TENANT-002', [
      { serviceId: 'SVC-A', currentCost: 200, baseline: 100, category: 'compute' },
      { serviceId: 'SVC-B', currentCost: 100, baseline: 100, category: 'storage' },
      { serviceId: 'SVC-C', currentCost: 100, baseline: 100, category: 'network' },
      { serviceId: 'SVC-D', currentCost: 100, baseline: 100, category: 'db' },
    ]);
    // 1/4 = 0.25 > 0.2
    expect(result.overallStatus).toBe('WARNING');
  });

  it('NORMAL: 이상 없음', () => {
    const result = detector.detect('TENANT-003', [
      { serviceId: 'SVC-A', currentCost: 120, baseline: 100, category: 'compute' },
    ]);
    // 1.3 임계값 초과 안 함 (1.2 < 1.3)
    expect(result.overallStatus).toBe('NORMAL');
    expect(result.anomalyCount).toBe(0);
  });

  it('이상 탐지: current > baseline × 1.3', () => {
    const result = detector.detect('TENANT-004', [
      { serviceId: 'SVC-A', currentCost: 131, baseline: 100, category: 'compute' },
    ]);
    expect(result.anomalies[0]!.isAnomaly).toBe(true);
  });

  it('초과율 계산 소수점 1자리', () => {
    const result = detector.detect('TENANT-005', [
      { serviceId: 'SVC-A', currentCost: 150, baseline: 100, category: 'compute' },
    ]);
    expect(result.anomalies[0]!.overrunRate).toBeCloseTo(50, 0);
  });

  it('빈 서비스 → NORMAL', () => {
    const result = detector.detect('TENANT-006', []);
    expect(result.overallStatus).toBe('NORMAL');
    expect(result.anomalyCount).toBe(0);
  });

  it('감사 로그 기록', () => {
    detector.detect('TENANT-007', []);
    expect(detector.getAuditLog()).toHaveLength(1);
    expect(detector.getAuditLog()[0]!.action).toBe('COST_ANOMALY_DETECTED_V4');
  });
});
