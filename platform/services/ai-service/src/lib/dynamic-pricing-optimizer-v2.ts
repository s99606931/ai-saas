// Design Ref: SVC-AI-ADV-R667.design.md — AI기반 동적 가격 최적화 v2
// Plan SC: FR-R667.1~5

import { createHash } from 'crypto';

interface PricingInput {
  basePrice: number;
  demandRatio: number;
  facilityOwner: string;
}
interface PricingResult {
  recommendedPrice: number;
  demandFactor: number;
  maskedOwner: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2.0;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class DynamicPricingOptimizerV2 {
  private auditLog: AuditEntry[] = [];

  optimize(input: PricingInput, dataGrade?: string): PricingResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (input.basePrice < 0) {
      throw new Error('basePrice must be non-negative');
    }
    const demandFactor = clamp(input.demandRatio, MIN_FACTOR, MAX_FACTOR);
    const recommendedPrice = Number((input.basePrice * demandFactor).toFixed(2));
    const maskedOwner = createHash('sha256').update(input.facilityOwner).digest('hex').substring(0, 16);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'OPTIMIZE_PRICE',
      details: { basePrice: input.basePrice, demandFactor, recommendedPrice },
    });
    return { recommendedPrice, demandFactor, maskedOwner };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
