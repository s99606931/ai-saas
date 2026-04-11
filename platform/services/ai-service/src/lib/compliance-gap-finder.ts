// 규정 준수 갭 자동 탐지 -- FR-N343.1~FR-N343.4
// Design Ref: MTU-N343 | CSAP: D-06, D-08, D-12

export interface ComplianceItem { readonly itemId: string; readonly regulation: string; readonly clause: string; readonly description: string; readonly priority: 'critical' | 'high' | 'medium' | 'low'; }
export interface ComplianceStatus { readonly itemId: string; readonly status: 'compliant' | 'partial' | 'non_compliant' | 'not_assessed'; readonly evidence: string; readonly assessedAt: string; }
export interface ComplianceGap { readonly gapId: string; readonly itemId: string; readonly regulation: string; readonly clause: string; readonly currentStatus: string; readonly gap: string; readonly priority: string; readonly remediation: string; }
export interface GapAnalysisReport { readonly reportId: string; readonly tenantId: string; readonly totalItems: number; readonly compliant: number; readonly gaps: readonly ComplianceGap[]; readonly complianceRate: number; readonly generatedAt: string; }
export interface CompGapAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: CompGapAuditEntry[] = [];
function recordAudit(entry: Omit<CompGapAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getCompGapAuditLog(tenantId: string): readonly CompGapAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const itemStore: Map<string, ComplianceItem[]> = new Map();

export function registerItem(tenantId: string, regulation: string, clause: string, description: string, priority: ComplianceItem['priority']): ComplianceItem {
  const item: ComplianceItem = { itemId: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, regulation, clause, description, priority };
  const existing = itemStore.get(tenantId) ?? [];
  existing.push(item);
  itemStore.set(tenantId, existing);
  return item;
}

export function analyzeGaps(tenantId: string, statuses: ComplianceStatus[]): GapAnalysisReport {
  const items = itemStore.get(tenantId) ?? [];
  const statusMap = new Map(statuses.map(s => [s.itemId, s]));
  const gaps: ComplianceGap[] = [];
  let compliant = 0;
  for (const item of items) {
    const status = statusMap.get(item.itemId);
    const current = status?.status ?? 'not_assessed';
    if (current === 'compliant') { compliant++; continue; }
    gaps.push({ gapId: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, itemId: item.itemId, regulation: item.regulation, clause: item.clause, currentStatus: current, gap: `${item.description}: ${current === 'partial' ? '부분 준수' : current === 'not_assessed' ? '미평가' : '미준수'}`, priority: item.priority, remediation: `${item.clause} 요건에 대한 ${current === 'partial' ? '보완' : '구현'} 필요` });
  }
  const rate = items.length > 0 ? compliant / items.length : 0;
  recordAudit({ actor: 'system', tenantId, action: 'GAP_ANALYSIS_COMPLETED', target: tenantId, details: { items: items.length, compliant, gaps: gaps.length, rate } });
  return { reportId: `gap-rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, totalItems: items.length, compliant, gaps, complianceRate: rate, generatedAt: new Date().toISOString() };
}

export class ComplianceGapFinderService {
  constructor(private readonly tenantId: string) {}
  register(reg: string, clause: string, desc: string, priority: ComplianceItem['priority']): ComplianceItem { return registerItem(this.tenantId, reg, clause, desc, priority); }
  analyze(statuses: ComplianceStatus[]): GapAnalysisReport { return analyzeGaps(this.tenantId, statuses); }
  getAuditLog(): readonly CompGapAuditEntry[] { return getCompGapAuditLog(this.tenantId); }
}
