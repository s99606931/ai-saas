// AI 리소스 최적화 엔진 -- FR-N280.1~FR-N280.6
// Design Ref: MTU-N280 DESIGN §1~§6
// CSAP: D-06 감사, D-07 모니터링, D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

export type ResourceType = 'cpu' | 'memory' | 'storage' | 'network';

export interface ResourceUsage {
  timestamp: string;
  resourceType: ResourceType;
  serviceName: string;
  requested: number;
  actual: number;
  limit: number;
  unit: string;
}

export interface SizingRecommendation {
  id: string;
  serviceName: string;
  resourceType: ResourceType;
  currentRequest: number;
  currentLimit: number;
  recommendedRequest: number;
  recommendedLimit: number;
  savingPct: number;
  confidence: number;
  reason: string;
}

export interface CostSimulation {
  id: string;
  currentMonthlyCost: number;
  optimizedMonthlyCost: number;
  savingAmount: number;
  savingPct: number;
  recommendations: SizingRecommendation[];
  createdAt: string;
}

export interface ScalingPolicy {
  id: string;
  serviceName: string;
  minReplicas: number;
  maxReplicas: number;
  targetCPUUtilization: number;
  targetMemoryUtilization: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownSeconds: number;
}

export interface ResourceAnomaly {
  id: string;
  serviceName: string;
  resourceType: ResourceType;
  expectedValue: number;
  actualValue: number;
  zScore: number;
  severity: 'warning' | 'critical';
  detectedAt: string;
}

// -- 감사 ────────────────────────────────────────────────────────────────────

const auditLog: { id: string; action: string; actor: string; timestamp: string }[] = [];

function recordAudit(action: string, actor: string): void {
  auditLog.push({ id: randomUUID(), action, actor, timestamp: new Date().toISOString() });
}

export function getResourceAuditLog() { return [...auditLog]; }

// -- §1 리소스 분석 ──────────────────────────────────────────────────────────

export function analyzeResourceUsage(
  usageData: ResourceUsage[],
  serviceName: string
): {
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  utilizationRate: number;
} {
  const serviceData = usageData
    .filter((u) => u.serviceName === serviceName)
    .map((u) => u.actual)
    .sort((a, b) => a - b);

  if (serviceData.length === 0) {
    return { avg: 0, p50: 0, p95: 0, p99: 0, max: 0, utilizationRate: 0 };
  }

  const avg = serviceData.reduce((a, b) => a + b, 0) / serviceData.length;
  const requested = usageData.filter((u) => u.serviceName === serviceName)[0]?.requested || 1;

  return {
    avg,
    p50: serviceData[Math.floor(serviceData.length * 0.50)] || 0,
    p95: serviceData[Math.floor(serviceData.length * 0.95)] || 0,
    p99: serviceData[Math.floor(serviceData.length * 0.99)] || 0,
    max: serviceData[serviceData.length - 1] || 0,
    utilizationRate: avg / requested,
  };
}

// -- §2 적정 사이징 추천 ─────────────────────────────────────────────────────

export function recommendSizing(
  usageData: ResourceUsage[],
  serviceName: string,
  resourceType: ResourceType,
  actor: string
): SizingRecommendation {
  const stats = analyzeResourceUsage(
    usageData.filter((u) => u.resourceType === resourceType),
    serviceName
  );

  const currentData = usageData.find(
    (u) => u.serviceName === serviceName && u.resourceType === resourceType
  );
  const currentRequest = currentData?.requested || 0;
  const currentLimit = currentData?.limit || 0;

  // P95 + 20% 마진 = 추천 request
  const recommendedRequest = Math.ceil(stats.p95 * 1.2);
  // P99 + 50% 마진 = 추천 limit
  const recommendedLimit = Math.ceil(stats.p99 * 1.5);

  const savingPct = currentRequest > 0
    ? Math.max(0, ((currentRequest - recommendedRequest) / currentRequest) * 100)
    : 0;

  let reason: string;
  if (stats.utilizationRate < 0.3) {
    reason = `사용률 ${(stats.utilizationRate * 100).toFixed(0)}% — 과다 할당. 축소 권장.`;
  } else if (stats.utilizationRate > 0.8) {
    reason = `사용률 ${(stats.utilizationRate * 100).toFixed(0)}% — 리소스 부족 위험. 확장 권장.`;
  } else {
    reason = `사용률 ${(stats.utilizationRate * 100).toFixed(0)}% — 적정 범위.`;
  }

  recordAudit('SIZING_RECOMMENDED', actor);

  return {
    id: randomUUID(),
    serviceName,
    resourceType,
    currentRequest,
    currentLimit,
    recommendedRequest,
    recommendedLimit,
    savingPct: Math.round(savingPct * 100) / 100,
    confidence: Math.min(0.95, 0.5 + usageData.length / 200),
    reason,
  };
}

// -- §3 비용 시뮬레이션 ──────────────────────────────────────────────────────

const COST_PER_UNIT: Record<ResourceType, number> = {
  cpu: 50000,     // 원/vCPU/월
  memory: 10000,  // 원/GB/월
  storage: 1000,  // 원/GB/월
  network: 500,   // 원/GB/월
};

export function simulateCostSaving(
  recommendations: SizingRecommendation[],
  actor: string
): CostSimulation {
  let currentCost = 0;
  let optimizedCost = 0;

  for (const rec of recommendations) {
    const unitCost = COST_PER_UNIT[rec.resourceType];
    currentCost += rec.currentRequest * unitCost;
    optimizedCost += rec.recommendedRequest * unitCost;
  }

  const saving = Math.max(0, currentCost - optimizedCost);

  recordAudit('COST_SIMULATED', actor);

  return {
    id: randomUUID(),
    currentMonthlyCost: currentCost,
    optimizedMonthlyCost: optimizedCost,
    savingAmount: saving,
    savingPct: currentCost > 0 ? (saving / currentCost) * 100 : 0,
    recommendations,
    createdAt: new Date().toISOString(),
  };
}

// -- §4 스케일링 정책 제안 ────────────────────────────────────────────────────

export function suggestScalingPolicy(
  usageData: ResourceUsage[],
  serviceName: string
): ScalingPolicy {
  const cpuStats = analyzeResourceUsage(
    usageData.filter((u) => u.resourceType === 'cpu'),
    serviceName
  );

  return {
    id: randomUUID(),
    serviceName,
    minReplicas: 2,
    maxReplicas: cpuStats.utilizationRate > 0.7 ? 10 : 5,
    targetCPUUtilization: 70,
    targetMemoryUtilization: 75,
    scaleUpThreshold: 80,
    scaleDownThreshold: 30,
    cooldownSeconds: 300,
  };
}

// -- §5 이상 감지 ────────────────────────────────────────────────────────────

export function detectResourceAnomalies(
  usageData: ResourceUsage[],
  serviceName: string,
  actor: string
): ResourceAnomaly[] {
  const anomalies: ResourceAnomaly[] = [];
  const types: ResourceType[] = ['cpu', 'memory', 'storage', 'network'];

  for (const resourceType of types) {
    const values = usageData
      .filter((u) => u.serviceName === serviceName && u.resourceType === resourceType)
      .map((u) => u.actual);

    if (values.length < 3) continue;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stddev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);

    const latest = values[values.length - 1] ?? 0;
    const zScore = stddev > 0 ? (latest - mean) / stddev : 0;

    if (Math.abs(zScore) > 2) {
      anomalies.push({
        id: randomUUID(),
        serviceName,
        resourceType,
        expectedValue: mean,
        actualValue: latest,
        zScore,
        severity: Math.abs(zScore) > 3 ? 'critical' : 'warning',
        detectedAt: new Date().toISOString(),
      });
    }
  }

  if (anomalies.length > 0) {
    recordAudit('RESOURCE_ANOMALY_DETECTED', actor);
  }

  return anomalies;
}
