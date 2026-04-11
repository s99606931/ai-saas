// 정부 KPI/BSC 자동 분석 -- FR-N341.1~FR-N341.4
// Design Ref: MTU-N341 | CSAP: D-06, D-08

export interface KPIDefinition { readonly kpiId: string; readonly tenantId: string; readonly name: string; readonly perspective: 'financial' | 'customer' | 'process' | 'learning'; readonly target: number; readonly unit: string; readonly weight: number; }
export interface KPIResult { readonly kpiId: string; readonly name: string; readonly target: number; readonly actual: number; readonly achievementRate: number; readonly grade: 'S' | 'A' | 'B' | 'C' | 'D'; }
export interface BSCScore { readonly tenantId: string; readonly financial: number; readonly customer: number; readonly process: number; readonly learning: number; readonly overall: number; readonly generatedAt: string; }
export interface KPIAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: KPIAuditEntry[] = [];
function recordAudit(entry: Omit<KPIAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getKPIAuditLog(tenantId: string): readonly KPIAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const kpiStore: Map<string, KPIDefinition[]> = new Map();

export function registerKPI(tenantId: string, name: string, perspective: KPIDefinition['perspective'], target: number, unit: string, weight: number = 1): KPIDefinition {
  const kpi: KPIDefinition = { kpiId: `kpi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, name, perspective, target, unit, weight };
  const existing = kpiStore.get(tenantId) ?? [];
  existing.push(kpi);
  kpiStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'KPI_REGISTERED', target: kpi.kpiId, details: { name, perspective, target } });
  return kpi;
}

function toGrade(rate: number): KPIResult['grade'] {
  if (rate >= 120) return 'S';
  if (rate >= 100) return 'A';
  if (rate >= 80) return 'B';
  if (rate >= 60) return 'C';
  return 'D';
}

export function evaluateKPI(kpi: KPIDefinition, actual: number): KPIResult {
  const rate = kpi.target > 0 ? (actual / kpi.target) * 100 : 0;
  return { kpiId: kpi.kpiId, name: kpi.name, target: kpi.target, actual, achievementRate: rate, grade: toGrade(rate) };
}

export function calculateBSC(tenantId: string, results: KPIResult[]): BSCScore {
  const kpis = kpiStore.get(tenantId) ?? [];
  const groups: Record<string, { total: number; weight: number }> = { financial: { total: 0, weight: 0 }, customer: { total: 0, weight: 0 }, process: { total: 0, weight: 0 }, learning: { total: 0, weight: 0 } };
  for (const r of results) {
    const kpi = kpis.find(k => k.kpiId === r.kpiId);
    if (kpi) { const g = groups[kpi.perspective]; if (g) { g.total += r.achievementRate * kpi.weight; g.weight += kpi.weight; } }
  }
  const score = (p: string) => { const g = groups[p]; return g && g.weight > 0 ? g.total / g.weight : 0; };
  const financial = score('financial'); const customer = score('customer'); const process = score('process'); const learning = score('learning');
  const overall = (financial + customer + process + learning) / 4;
  recordAudit({ actor: 'system', tenantId, action: 'BSC_CALCULATED', target: tenantId, details: { financial, customer, process, learning, overall } });
  return { tenantId, financial, customer, process, learning, overall, generatedAt: new Date().toISOString() };
}

export class GovKPIAnalyzerService {
  constructor(private readonly tenantId: string) {}
  register(name: string, persp: KPIDefinition['perspective'], target: number, unit: string, weight?: number): KPIDefinition { return registerKPI(this.tenantId, name, persp, target, unit, weight); }
  evaluate(kpi: KPIDefinition, actual: number): KPIResult { return evaluateKPI(kpi, actual); }
  bsc(results: KPIResult[]): BSCScore { return calculateBSC(this.tenantId, results); }
  getAuditLog(): readonly KPIAuditEntry[] { return getKPIAuditLog(this.tenantId); }
}
