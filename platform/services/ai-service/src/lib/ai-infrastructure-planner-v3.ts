// Design Ref: SVC-AI-ADV-R706.design.md — AI기반 인프라 계획 자동화 v3
// Plan SC: FR-R706.1~5

import { createHash } from 'crypto';

export type PlanAction = 'SCALE_UP' | 'HOLD' | 'SCALE_DOWN';

interface ResourceSpec { cpu: number; memory: number; disk: number }
interface Workload {
  workloadId: string;
  baseline: ResourceSpec;
}
interface DemandInput {
  workloadId: string;
  forecast: ResourceSpec;
}
interface PlanResult {
  maskedWorkloadId: string;
  plan: ResourceSpec;
  action: PlanAction;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const SAFETY_FACTOR = 1.2;

function maskId(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

function applySafety(spec: ResourceSpec): ResourceSpec {
  return {
    cpu: Math.ceil(spec.cpu * SAFETY_FACTOR),
    memory: Math.ceil(spec.memory * SAFETY_FACTOR),
    disk: Math.ceil(spec.disk * SAFETY_FACTOR),
  };
}

function validateSpec(spec: ResourceSpec, label: string): void {
  if (spec.cpu < 0 || spec.memory < 0 || spec.disk < 0) throw new Error(`INVALID_${label}`);
}

export class AIInfrastructurePlannerV3 {
  private workloads = new Map<string, Workload>();
  private auditLog: AuditEntry[] = [];

  registerWorkload(w: Workload): void {
    validateSpec(w.baseline, 'BASELINE');
    this.workloads.set(w.workloadId, w);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_WORKLOAD',
      details: { maskedWorkloadId: maskId(w.workloadId) },
    });
  }

  plan(input: DemandInput, dataGrade?: string): PlanResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const w = this.workloads.get(input.workloadId);
    if (!w) throw new Error(`UNKNOWN_WORKLOAD: ${input.workloadId}`);
    validateSpec(input.forecast, 'FORECAST');
    const plan = applySafety(input.forecast);
    const baselineTotal = w.baseline.cpu + w.baseline.memory + w.baseline.disk;
    const planTotal = plan.cpu + plan.memory + plan.disk;
    let action: PlanAction;
    if (planTotal > baselineTotal * 1.1) action = 'SCALE_UP';
    else if (planTotal < baselineTotal * 0.5) action = 'SCALE_DOWN';
    else action = 'HOLD';
    const masked = maskId(input.workloadId);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'PLAN',
      details: { maskedWorkloadId: masked, plan, action },
    });
    return { maskedWorkloadId: masked, plan, action };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
