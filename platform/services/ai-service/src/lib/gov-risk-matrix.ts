// 공공기관 리스크 매트릭스 -- FR-N359.1~FR-N359.4
// Design Ref: MTU-N359 | CSAP: D-06, D-08

export interface RiskItem { readonly riskId: string; readonly tenantId: string; readonly title: string; readonly category: string; readonly likelihood: 1 | 2 | 3 | 4 | 5; readonly impact: 1 | 2 | 3 | 4 | 5; readonly score: number; readonly level: 'low' | 'medium' | 'high' | 'critical'; readonly mitigation: string; }
export interface RiskHeatmap { readonly tenantId: string; readonly totalRisks: number; readonly critical: number; readonly high: number; readonly medium: number; readonly low: number; readonly topRisks: readonly RiskItem[]; readonly generatedAt: string; }
export interface RiskAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: RiskAuditEntry[] = [];
function recordAudit(entry: Omit<RiskAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getRiskAuditLog(tenantId: string): readonly RiskAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const riskStore: Map<string, RiskItem[]> = new Map();

function calculateLevel(score: number): RiskItem['level'] {
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

export function registerRisk(tenantId: string, title: string, category: string, likelihood: RiskItem['likelihood'], impact: RiskItem['impact'], mitigation: string): RiskItem {
  const score = likelihood * impact;
  const risk: RiskItem = { riskId: `risk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, title, category, likelihood, impact, score, level: calculateLevel(score), mitigation };
  const existing = riskStore.get(tenantId) ?? [];
  existing.push(risk);
  riskStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'RISK_REGISTERED', target: risk.riskId, details: { title, score, level: risk.level } });
  return risk;
}

export function getRisks(tenantId: string): readonly RiskItem[] { return riskStore.get(tenantId) ?? []; }

export function generateHeatmap(tenantId: string): RiskHeatmap {
  const risks = riskStore.get(tenantId) ?? [];
  const critical = risks.filter(r => r.level === 'critical').length;
  const high = risks.filter(r => r.level === 'high').length;
  const medium = risks.filter(r => r.level === 'medium').length;
  const low = risks.filter(r => r.level === 'low').length;
  const topRisks = [...risks].sort((a, b) => b.score - a.score).slice(0, 5);
  recordAudit({ actor: 'system', tenantId, action: 'HEATMAP_GENERATED', target: tenantId, details: { total: risks.length, critical, high } });
  return { tenantId, totalRisks: risks.length, critical, high, medium, low, topRisks, generatedAt: new Date().toISOString() };
}

export class GovRiskMatrixService {
  constructor(private readonly tenantId: string) {}
  register(title: string, cat: string, likelihood: RiskItem['likelihood'], impact: RiskItem['impact'], mitigation: string): RiskItem { return registerRisk(this.tenantId, title, cat, likelihood, impact, mitigation); }
  list(): readonly RiskItem[] { return getRisks(this.tenantId); }
  heatmap(): RiskHeatmap { return generateHeatmap(this.tenantId); }
  getAuditLog(): readonly RiskAuditEntry[] { return getRiskAuditLog(this.tenantId); }
}
