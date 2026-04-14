// Design Ref: SVC-AI-ADV-R699.design.md — AI 거버넌스 대시보드 자동화 v2
// Plan SC: FR-R699.1~5

import { createHash } from 'crypto';

export type GovernanceStatus = 'ON_TRACK' | 'MONITOR' | 'AT_RISK';

interface GovernanceKpi {
  kpiId: string;
  target: number;
  weight: number;
}
interface KpiMetric {
  kpiId: string;
  reporterId: string;
  actual: number;
}
interface KpiLatest {
  kpi: GovernanceKpi;
  attainment: number;
}
interface DashboardVerdict {
  overallScore: number;
  status: GovernanceStatus;
  maskedReporterId: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class AIGovernanceDashboardV2 {
  private kpis = new Map<string, GovernanceKpi>();
  private latest = new Map<string, KpiLatest>();
  private auditLog: AuditEntry[] = [];

  registerKpi(kpi: GovernanceKpi): void {
    if (kpi.weight < 0 || kpi.weight > 1) {
      throw new Error('INVALID_WEIGHT');
    }
    if (kpi.target <= 0) {
      throw new Error('INVALID_TARGET');
    }
    this.kpis.set(kpi.kpiId, kpi);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_KPI',
      details: { kpiId: kpi.kpiId, target: kpi.target, weight: kpi.weight },
    });
  }

  reportMetric(metric: KpiMetric, dataGrade?: string): DashboardVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const kpi = this.kpis.get(metric.kpiId);
    if (!kpi) {
      throw new Error(`UNKNOWN_KPI: ${metric.kpiId}`);
    }
    if (metric.actual < 0) {
      throw new Error('INVALID_ACTUAL');
    }

    const attainment = Math.min((metric.actual / kpi.target) * 100, 150);
    this.latest.set(metric.kpiId, { kpi, attainment });

    let weightSum = 0;
    let weighted = 0;
    for (const entry of this.latest.values()) {
      weightSum += entry.kpi.weight;
      weighted += entry.attainment * entry.kpi.weight;
    }
    const overallScore = weightSum > 0 ? weighted / weightSum : 0;

    let status: GovernanceStatus;
    if (overallScore < 70) status = 'AT_RISK';
    else if (overallScore < 90) status = 'MONITOR';
    else status = 'ON_TRACK';

    const maskedReporterId = maskPII(metric.reporterId);
    const verdict: DashboardVerdict = {
      overallScore,
      status,
      maskedReporterId,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REPORT_METRIC',
      details: { kpiId: metric.kpiId, attainment, overallScore, status, maskedReporterId },
    });
    return verdict;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
