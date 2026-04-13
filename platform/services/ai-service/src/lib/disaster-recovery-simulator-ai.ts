// Design Ref: §핵심 알고리즘 — RTO 합산 시뮬레이션
// Plan SC: FR-R277.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface DisasterScenario {
  id: string;
  type: string;
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  targetRPOMinutes: number;
  steps: RecoveryStep[];
}

interface RecoveryStep {
  name: string;
  estimatedMinutes: number;
}

interface StepResult {
  stepName: string;
  estimatedMinutes: number;
  status: 'completed';
}

interface SimulationResult {
  scenarioId: string;
  totalRTOMinutes: number;
  targetRPOMinutes: number;
  rpoAchieved: boolean;
  steps: StepResult[];
  simulatedAt: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R277.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class DisasterRecoverySimulatorAI {
  private scenarios = new Map<string, DisasterScenario>();
  private history: SimulationResult[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R277.1
  registerScenario(id: string, type: string, impactLevel: 'low' | 'medium' | 'high' | 'critical', targetRPOMinutes: number): void {
    this.scenarios.set(id, { id, type, impactLevel, targetRPOMinutes, steps: [] });
    this.log('REGISTER_SCENARIO', { id, type, impactLevel, targetRPOMinutes });
  }

  // Plan SC: FR-R277.2
  addRecoveryStep(scenarioId: string, stepName: string, estimatedMinutes: number): void {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error(`시나리오 미등록: ${scenarioId}`);
    if (estimatedMinutes < 0) throw new Error('estimatedMinutes는 0 이상이어야 합니다');
    scenario.steps.push({ name: stepName, estimatedMinutes });
    this.log('ADD_RECOVERY_STEP', { scenarioId, stepName, estimatedMinutes });
  }

  // Plan SC: FR-R277.3 + R277.4
  simulate(scenarioId: string, grade: DataGrade = DataGrade.O): SimulationResult {
    guardDataGrade(grade);
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error(`시나리오 미등록: ${scenarioId}`);

    const steps: StepResult[] = scenario.steps.map(s => ({
      stepName: s.name,
      estimatedMinutes: s.estimatedMinutes,
      status: 'completed' as const,
    }));

    const totalRTOMinutes = steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const rpoAchieved = totalRTOMinutes <= scenario.targetRPOMinutes;

    const result: SimulationResult = {
      scenarioId,
      totalRTOMinutes,
      targetRPOMinutes: scenario.targetRPOMinutes,
      rpoAchieved,
      steps,
      simulatedAt: new Date().toISOString(),
    };

    this.history.push(result);
    this.log('SIMULATE', { scenarioId, totalRTOMinutes, rpoAchieved });
    return result;
  }

  getSimulationHistory(scenarioId?: string): SimulationResult[] {
    if (scenarioId) return this.history.filter(r => r.scenarioId === scenarioId);
    return [...this.history];
  }

  // Plan SC: FR-R277.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
