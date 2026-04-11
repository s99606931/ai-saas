// 리소스 비용 배분 엔진 -- FR-N355.1~FR-N355.4
// Design Ref: MTU-N355 | CSAP: D-06, D-08

export interface CostItem { readonly itemId: string; readonly category: string; readonly description: string; readonly totalCost: number; readonly currency: string; readonly period: string; }
export interface TenantUsageShare { readonly tenantId: string; readonly usage: number; readonly unit: string; }
export interface CostAllocation { readonly tenantId: string; readonly itemId: string; readonly category: string; readonly allocatedCost: number; readonly sharePercentage: number; readonly currency: string; }
export interface CostReport { readonly reportId: string; readonly period: string; readonly totalCost: number; readonly allocations: readonly CostAllocation[]; readonly generatedAt: string; }
export interface CostAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: CostAuditEntry[] = [];
function recordAudit(entry: Omit<CostAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getCostAuditLog(tenantId: string): readonly CostAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

export function createCostItem(category: string, description: string, totalCost: number, currency: string = 'KRW', period: string = '2026-04'): CostItem {
  return { itemId: `cost-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, category, description, totalCost, currency, period };
}

export function allocateByUsage(item: CostItem, shares: TenantUsageShare[]): CostAllocation[] {
  const totalUsage = shares.reduce((s, sh) => s + sh.usage, 0);
  if (totalUsage === 0) return [];
  return shares.map(sh => ({
    tenantId: sh.tenantId, itemId: item.itemId, category: item.category, allocatedCost: Math.round((sh.usage / totalUsage) * item.totalCost * 100) / 100, sharePercentage: Math.round((sh.usage / totalUsage) * 10000) / 100, currency: item.currency
  }));
}

export function generateCostReport(reportTenantId: string, period: string, items: CostItem[], allShares: Map<string, TenantUsageShare[]>): CostReport {
  const allAllocations: CostAllocation[] = [];
  let totalCost = 0;
  for (const item of items) {
    totalCost += item.totalCost;
    const shares = allShares.get(item.itemId) ?? [];
    allAllocations.push(...allocateByUsage(item, shares));
  }
  recordAudit({ actor: 'system', tenantId: reportTenantId, action: 'COST_REPORT_GENERATED', target: reportTenantId, details: { period, items: items.length, allocations: allAllocations.length, totalCost } });
  return { reportId: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, period, totalCost, allocations: allAllocations, generatedAt: new Date().toISOString() };
}

export function getTenantCosts(allocations: readonly CostAllocation[], tenantId: string): { totalCost: number; items: readonly CostAllocation[] } {
  const items = allocations.filter(a => a.tenantId === tenantId);
  const totalCost = items.reduce((s, a) => s + a.allocatedCost, 0);
  return { totalCost, items };
}

export class ResourceCostAllocatorService {
  constructor(private readonly tenantId: string) {}
  createItem(cat: string, desc: string, cost: number, currency?: string, period?: string): CostItem { return createCostItem(cat, desc, cost, currency, period); }
  allocate(item: CostItem, shares: TenantUsageShare[]): CostAllocation[] { return allocateByUsage(item, shares); }
  report(period: string, items: CostItem[], shares: Map<string, TenantUsageShare[]>): CostReport { return generateCostReport(this.tenantId, period, items, shares); }
  myCosts(allocations: readonly CostAllocation[]): ReturnType<typeof getTenantCosts> { return getTenantCosts(allocations, this.tenantId); }
  getAuditLog(): readonly CostAuditEntry[] { return getCostAuditLog(this.tenantId); }
}
