// 정책 시뮬레이션 엔진 -- FR-N357.1~FR-N357.4
// Design Ref: MTU-N357 | CSAP: D-06, D-08

export interface PolicyScenario { readonly scenarioId: string; readonly name: string; readonly parameters: Record<string, number>; readonly description: string; }
export interface SimulationResult { readonly scenarioId: string; readonly scenarioName: string; readonly metrics: Record<string, number>; readonly impact: 'positive' | 'negative' | 'neutral'; readonly confidence: number; }
export interface ImpactReport { readonly reportId: string; readonly tenantId: string; readonly scenarios: readonly SimulationResult[]; readonly bestScenario: string; readonly generatedAt: string; }
export interface PolicySimAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: PolicySimAuditEntry[] = [];
function recordAudit(entry: Omit<PolicySimAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getPolicySimAuditLog(tenantId: string): readonly PolicySimAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

export function defineScenario(name: string, parameters: Record<string, number>, description: string = ''): PolicyScenario {
  return { scenarioId: `ps-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, parameters, description };
}

export function simulate(scenario: PolicyScenario, baselineMetrics: Record<string, number>): SimulationResult {
  const resultMetrics: Record<string, number> = {};
  let totalChange = 0;
  for (const [key, base] of Object.entries(baselineMetrics)) {
    const factor = scenario.parameters[key] ?? 1;
    const adjusted = base * factor;
    resultMetrics[key] = Math.round(adjusted * 100) / 100;
    totalChange += adjusted - base;
  }
  const impact: SimulationResult['impact'] = totalChange > 0 ? 'positive' : totalChange < 0 ? 'negative' : 'neutral';
  const confidence = Math.min(0.95, 0.5 + Object.keys(scenario.parameters).length * 0.1);
  return { scenarioId: scenario.scenarioId, scenarioName: scenario.name, metrics: resultMetrics, impact, confidence };
}

export function generateImpactReport(tenantId: string, scenarios: PolicyScenario[], baseline: Record<string, number>): ImpactReport {
  const results = scenarios.map(s => simulate(s, baseline));
  const positives = results.filter(r => r.impact === 'positive');
  const best = positives.length > 0 ? positives.sort((a, b) => b.confidence - a.confidence)[0]!.scenarioName : results[0]?.scenarioName ?? 'N/A';
  recordAudit({ actor: 'system', tenantId, action: 'POLICY_SIMULATION_COMPLETED', target: tenantId, details: { scenarios: scenarios.length, best } });
  return { reportId: `pir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, scenarios: results, bestScenario: best, generatedAt: new Date().toISOString() };
}

export class PolicySimulatorService {
  constructor(private readonly tenantId: string) {}
  define(name: string, params: Record<string, number>, desc?: string): PolicyScenario { return defineScenario(name, params, desc); }
  simulate(scenario: PolicyScenario, baseline: Record<string, number>): SimulationResult { return simulate(scenario, baseline); }
  report(scenarios: PolicyScenario[], baseline: Record<string, number>): ImpactReport { return generateImpactReport(this.tenantId, scenarios, baseline); }
  getAuditLog(): readonly PolicySimAuditEntry[] { return getPolicySimAuditLog(this.tenantId); }
}
