// Design Ref: SVC-AI-ADV-R669.design.md — AI기반 마이크로서비스 카오스 테스팅 v2
// Plan SC: FR-R669.1~5

import { createHash } from 'crypto';

export type ChaosType = 'LATENCY' | 'ERROR' | 'NETWORK_PARTITION';
export type ResilienceGrade = 'RESILIENT' | 'MARGINAL' | 'FRAGILE';

interface ChaosScenario {
  scenarioId: string;
  maskedTarget: string;
  type: ChaosType;
  intensity: number;
}
interface Observation {
  errorRate: number;
  p95LatencyMs: number;
  baselineLatencyMs: number;
}
interface EvaluationResult {
  resilienceScore: number;
  grade: ResilienceGrade;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function mask(v: string): string {
  return createHash('sha256').update(v).digest('hex').substring(0, 16);
}

export class MicroserviceChaosTesterAIV2 {
  private auditLog: AuditEntry[] = [];
  private counter = 0;

  generateScenario(targetService: string, type: ChaosType, dataGrade?: string): ChaosScenario {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const intensityMap: Record<ChaosType, number> = {
      LATENCY: 0.5,
      ERROR: 0.3,
      NETWORK_PARTITION: 0.7,
    };
    this.counter += 1;
    const scenario: ChaosScenario = {
      scenarioId: `chaos-${this.counter}`,
      maskedTarget: mask(targetService),
      type,
      intensity: intensityMap[type],
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'GENERATE_SCENARIO',
      details: { scenarioId: scenario.scenarioId, type },
    });
    return scenario;
  }

  evaluate(obs: Observation): EvaluationResult {
    const errPart = 1 - Math.max(0, Math.min(1, obs.errorRate));
    const latencyRatio = obs.baselineLatencyMs > 0 ? obs.p95LatencyMs / obs.baselineLatencyMs : 1;
    const latencyPenalty = Math.max(0, Math.min(1, (latencyRatio - 1) / 5));
    const resilienceScore = Number(Math.max(0, errPart - latencyPenalty * 0.3).toFixed(4));

    let grade: ResilienceGrade;
    if (resilienceScore >= 0.8) grade = 'RESILIENT';
    else if (resilienceScore >= 0.5) grade = 'MARGINAL';
    else grade = 'FRAGILE';

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'EVALUATE',
      details: { resilienceScore, grade },
    });
    return { resilienceScore, grade };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
