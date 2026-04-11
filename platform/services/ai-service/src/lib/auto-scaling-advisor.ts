// 자동 용량 스케일링 권고 -- FR-N325.1~FR-N325.4
// Design Ref: MTU-N325 | CSAP: D-06, D-08

export interface ResourceUtilization { readonly resourceId: string; readonly serviceName: string; readonly metricType: 'cpu' | 'memory' | 'disk' | 'network'; readonly current: number; readonly peak: number; readonly average: number; readonly capacity: number; readonly unit: string; readonly timestamp: string; }
export interface ScalingRecommendation { readonly recommendationId: string; readonly serviceName: string; readonly action: 'scale_up' | 'scale_down' | 'scale_out' | 'scale_in' | 'no_change'; readonly reason: string; readonly currentReplicas: number; readonly recommendedReplicas: number; readonly estimatedSavings: number; readonly urgency: 'immediate' | 'scheduled' | 'optional'; }
export interface ScalingPolicy { readonly policyId: string; readonly tenantId: string; readonly serviceName: string; readonly minReplicas: number; readonly maxReplicas: number; readonly targetCpuUtilization: number; readonly targetMemoryUtilization: number; readonly cooldownSeconds: number; }
export interface ScalingAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: ScalingAuditEntry[] = [];
function recordAudit(entry: Omit<ScalingAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getScalingAuditLog(tenantId: string): readonly ScalingAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const policyStore: Map<string, ScalingPolicy[]> = new Map();

export function createScalingPolicy(tenantId: string, serviceName: string, minReplicas: number = 1, maxReplicas: number = 10, targetCpu: number = 70, targetMem: number = 80): ScalingPolicy {
  const policy: ScalingPolicy = { policyId: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, serviceName, minReplicas, maxReplicas, targetCpuUtilization: targetCpu, targetMemoryUtilization: targetMem, cooldownSeconds: 300 };
  const existing = policyStore.get(tenantId) ?? [];
  existing.push(policy);
  policyStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'SCALING_POLICY_CREATED', target: policy.policyId, details: { serviceName, minReplicas, maxReplicas } });
  return policy;
}

export function analyzeAndRecommend(tenantId: string, utilizations: ResourceUtilization[], currentReplicas: number): ScalingRecommendation[] {
  const serviceGroups = new Map<string, ResourceUtilization[]>();
  for (const u of utilizations) { const existing = serviceGroups.get(u.serviceName) ?? []; existing.push(u); serviceGroups.set(u.serviceName, existing); }

  const recommendations: ScalingRecommendation[] = [];
  const policies = policyStore.get(tenantId) ?? [];

  for (const [serviceName, metrics] of serviceGroups.entries()) {
    const policy = policies.find(p => p.serviceName === serviceName);
    const cpuMetric = metrics.find(m => m.metricType === 'cpu');
    const memMetric = metrics.find(m => m.metricType === 'memory');
    const cpuAvg = cpuMetric ? (cpuMetric.average / cpuMetric.capacity) * 100 : 50;
    const memAvg = memMetric ? (memMetric.average / memMetric.capacity) * 100 : 50;
    const targetCpu = policy?.targetCpuUtilization ?? 70;
    const targetMem = policy?.targetMemoryUtilization ?? 80;
    const maxR = policy?.maxReplicas ?? 10;
    const minR = policy?.minReplicas ?? 1;

    let action: ScalingRecommendation['action'] = 'no_change';
    let reason = '현재 리소스 사용량 정상 범위';
    let recommended = currentReplicas;
    let urgency: ScalingRecommendation['urgency'] = 'optional';
    let savings = 0;

    if (cpuAvg > targetCpu || memAvg > targetMem) {
      action = 'scale_out';
      recommended = Math.min(maxR, currentReplicas + Math.ceil((cpuAvg - targetCpu) / 20));
      reason = `${cpuAvg > targetCpu ? 'CPU' : '메모리'} 사용률 높음 (${Math.max(cpuAvg, memAvg).toFixed(0)}%)`;
      urgency = cpuAvg > 90 || memAvg > 90 ? 'immediate' : 'scheduled';
    } else if (cpuAvg < targetCpu * 0.3 && memAvg < targetMem * 0.3 && currentReplicas > minR) {
      action = 'scale_in';
      recommended = Math.max(minR, currentReplicas - 1);
      reason = `리소스 과다 할당 (CPU: ${cpuAvg.toFixed(0)}%, MEM: ${memAvg.toFixed(0)}%)`;
      urgency = 'scheduled';
      savings = (currentReplicas - recommended) * 100000; // 월 비용 시뮬레이션
    }

    recommendations.push({ recommendationId: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, serviceName, action, reason, currentReplicas, recommendedReplicas: recommended, estimatedSavings: savings, urgency });
  }

  recordAudit({ actor: 'system', tenantId, action: 'SCALING_ANALYZED', target: tenantId, details: { servicesAnalyzed: serviceGroups.size, recommendations: recommendations.length } });
  return recommendations;
}

export class AutoScalingAdvisorService {
  constructor(private readonly tenantId: string) {}
  createPolicy(service: string, min?: number, max?: number): ScalingPolicy { return createScalingPolicy(this.tenantId, service, min, max); }
  analyze(utilizations: ResourceUtilization[], replicas: number): ScalingRecommendation[] { return analyzeAndRecommend(this.tenantId, utilizations, replicas); }
  getAuditLog(): readonly ScalingAuditEntry[] { return getScalingAuditLog(this.tenantId); }
}
