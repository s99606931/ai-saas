// Design Ref: SVC-AI-ADV-R696.design.md — AI기반 멀티테넌트 비용 최적화 v3
// Plan SC: FR-R696.1~5

import { createHash } from 'crypto';

export type CostRecommendation = 'OK' | 'REVIEW' | 'RESIZE';

interface TenantConfig {
  tenantId: string;
  budget: number;
}
interface UsageReport {
  tenantId: string;
  contactId: string;
  totalCost: number;
  idleCost: number;
}
interface CostVerdict {
  tenantId: string;
  wasteRate: number;
  recommendation: CostRecommendation;
  maskedContactId: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class MultiTenantCostOptimizerV3 {
  private tenants = new Map<string, TenantConfig>();
  private auditLog: AuditEntry[] = [];

  registerTenant(tenant: TenantConfig): void {
    if (tenant.budget <= 0) {
      throw new Error('INVALID_BUDGET');
    }
    this.tenants.set(tenant.tenantId, tenant);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_TENANT',
      details: { tenantId: tenant.tenantId, budget: tenant.budget },
    });
  }

  reportUsage(usage: UsageReport, dataGrade?: string): CostVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (!this.tenants.has(usage.tenantId)) {
      throw new Error(`UNKNOWN_TENANT: ${usage.tenantId}`);
    }
    if (usage.totalCost <= 0 || usage.idleCost < 0 || usage.idleCost > usage.totalCost) {
      throw new Error('INVALID_USAGE');
    }

    const wasteRate = (usage.idleCost / usage.totalCost) * 100;
    let recommendation: CostRecommendation;
    if (wasteRate >= 30) recommendation = 'RESIZE';
    else if (wasteRate >= 15) recommendation = 'REVIEW';
    else recommendation = 'OK';

    const maskedContactId = maskPII(usage.contactId);
    const verdict: CostVerdict = {
      tenantId: usage.tenantId,
      wasteRate,
      recommendation,
      maskedContactId,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REPORT_USAGE',
      details: { tenantId: usage.tenantId, wasteRate, recommendation, maskedContactId },
    });
    return verdict;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
