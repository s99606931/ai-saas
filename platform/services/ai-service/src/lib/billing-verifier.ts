// 비용 청구 내역 검증 -- FR-N323.1~FR-N323.4
// Design Ref: MTU-N323 | CSAP: D-06, D-08

export interface BillingItem { readonly itemId: string; readonly service: string; readonly description: string; readonly quantity: number; readonly unitPrice: number; readonly totalPrice: number; readonly period: string; }
export interface BillingDiscrepancy { readonly discrepancyId: string; readonly itemId: string; readonly type: 'overcharge' | 'duplicate' | 'missing' | 'calculation_error' | 'rate_mismatch'; readonly description: string; readonly expectedAmount: number; readonly actualAmount: number; readonly difference: number; }
export interface BillingVerificationResult { readonly verificationId: string; readonly tenantId: string; readonly totalItems: number; readonly totalAmount: number; readonly discrepancies: BillingDiscrepancy[]; readonly savingsOpportunity: number; readonly verifiedAt: string; }
export interface BillingAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: BillingAuditEntry[] = [];
function recordAudit(entry: Omit<BillingAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getBillingAuditLog(tenantId: string): readonly BillingAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

export function verifyCalculation(item: BillingItem): BillingDiscrepancy | null {
  const expected = item.quantity * item.unitPrice;
  const diff = Math.abs(item.totalPrice - expected);
  if (diff > 0.01) {
    return { discrepancyId: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, itemId: item.itemId, type: 'calculation_error', description: `${item.description}: 산출금액 불일치 (${item.quantity} x ${item.unitPrice} != ${item.totalPrice})`, expectedAmount: expected, actualAmount: item.totalPrice, difference: item.totalPrice - expected };
  }
  return null;
}

export function detectDuplicates(items: BillingItem[]): BillingDiscrepancy[] {
  const seen = new Map<string, BillingItem>();
  const duplicates: BillingDiscrepancy[] = [];
  for (const item of items) {
    const key = `${item.service}:${item.description}:${item.period}`;
    const existing = seen.get(key);
    if (existing) {
      duplicates.push({ discrepancyId: `disc-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, itemId: item.itemId, type: 'duplicate', description: `중복 청구 의심: ${item.description} (${item.period})`, expectedAmount: 0, actualAmount: item.totalPrice, difference: item.totalPrice });
    }
    seen.set(key, item);
  }
  return duplicates;
}

export function verifyBilling(tenantId: string, items: BillingItem[], _expectedRates?: Record<string, number>): BillingVerificationResult {
  const discrepancies: BillingDiscrepancy[] = [];
  for (const item of items) { const calc = verifyCalculation(item); if (calc) discrepancies.push(calc); }
  discrepancies.push(...detectDuplicates(items));
  // 과다 청구 탐지
  const avgPrice = items.length > 0 ? items.reduce((s, i) => s + i.totalPrice, 0) / items.length : 0;
  for (const item of items) {
    if (item.totalPrice > avgPrice * 3 && items.length > 3) {
      discrepancies.push({ discrepancyId: `disc-over-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, itemId: item.itemId, type: 'overcharge', description: `이상 고액 청구: ${item.description} (평균의 ${(item.totalPrice / avgPrice).toFixed(1)}배)`, expectedAmount: avgPrice, actualAmount: item.totalPrice, difference: item.totalPrice - avgPrice });
    }
  }
  const totalAmount = items.reduce((s, i) => s + i.totalPrice, 0);
  const savings = discrepancies.reduce((s, d) => s + Math.abs(d.difference), 0);
  recordAudit({ actor: 'system', tenantId, action: 'BILLING_VERIFIED', target: tenantId, details: { items: items.length, discrepancies: discrepancies.length, savings } });
  return { verificationId: `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, totalItems: items.length, totalAmount, discrepancies, savingsOpportunity: savings, verifiedAt: new Date().toISOString() };
}

export class BillingVerifierService {
  constructor(private readonly tenantId: string) {}
  verify(items: BillingItem[]): BillingVerificationResult { return verifyBilling(this.tenantId, items); }
  getAuditLog(): readonly BillingAuditEntry[] { return getBillingAuditLog(this.tenantId); }
}
