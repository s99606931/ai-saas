// Design Ref: §핵심 알고리즘 — 복잡도/중복도/노후화 가중 점수
// Plan SC: FR-R267.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ComponentProfile {
  id: string;
  name: string;
  language: string;
  linesOfCode: number;
}

interface TechMetrics {
  componentId: string;
  cyclomaticComplexity: number;
  duplicationPercent: number;
  outdatedDependencies: number;
  recordedAt: string;
}

interface DebtScore {
  componentId: string;
  complexityScore: number;
  duplicationScore: number;
  outdatedScore: number;
  totalDebt: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface DebtItem {
  componentId: string;
  componentName: string;
  totalDebt: number;
  severity: string;
  topIssue: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R267.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class TechDebtMeasurementAI {
  private components = new Map<string, ComponentProfile>();
  private metricsRecords: TechMetrics[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R267.1
  registerComponent(id: string, name: string, language: string, linesOfCode: number): void {
    this.components.set(id, { id, name, language, linesOfCode });
    this.log('REGISTER_COMPONENT', { id, name, language, linesOfCode });
  }

  // Plan SC: FR-R267.2
  recordMetrics(componentId: string, cyclomaticComplexity: number, duplicationPercent: number, outdatedDependencies: number, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.components.has(componentId)) throw new Error(`컴포넌트 미등록: ${componentId}`);
    this.metricsRecords.push({ componentId, cyclomaticComplexity, duplicationPercent, outdatedDependencies, recordedAt: new Date().toISOString() });
    this.log('RECORD_METRICS', { componentId, cyclomaticComplexity, duplicationPercent, outdatedDependencies });
  }

  // Plan SC: FR-R267.3
  calculateDebt(componentId: string): DebtScore {
    if (!this.components.has(componentId)) throw new Error(`컴포넌트 미등록: ${componentId}`);

    const records = this.metricsRecords.filter(m => m.componentId === componentId);
    if (records.length === 0) {
      return { componentId, complexityScore: 0, duplicationScore: 0, outdatedScore: 0, totalDebt: 0, severity: 'low' };
    }

    const latest = records[records.length - 1]!;
    const complexityScore = Math.min(100, latest.cyclomaticComplexity * 10);
    const duplicationScore = Math.min(100, latest.duplicationPercent);
    const outdatedScore = Math.min(100, latest.outdatedDependencies * 10);
    const totalDebt = Math.round(complexityScore * 0.4 + duplicationScore * 0.3 + outdatedScore * 0.3);

    const severity: 'critical' | 'high' | 'medium' | 'low' =
      totalDebt >= 75 ? 'critical' : totalDebt >= 50 ? 'high' : totalDebt >= 25 ? 'medium' : 'low';

    this.log('CALCULATE_DEBT', { componentId, totalDebt, severity });
    return { componentId, complexityScore, duplicationScore, outdatedScore, totalDebt, severity };
  }

  // Plan SC: FR-R267.4
  getPrioritizedDebt(): DebtItem[] {
    const items: DebtItem[] = [];

    for (const component of this.components.values()) {
      const debt = this.calculateDebt(component.id);
      if (debt.totalDebt === 0) continue;

      const scores = [
        { label: '복잡도', value: debt.complexityScore },
        { label: '중복도', value: debt.duplicationScore },
        { label: '의존성 노후화', value: debt.outdatedScore },
      ];
      const topIssue = scores.reduce((a, b) => a.value >= b.value ? a : b).label;

      items.push({ componentId: component.id, componentName: component.name, totalDebt: debt.totalDebt, severity: debt.severity, topIssue });
    }

    items.sort((a, b) => b.totalDebt - a.totalDebt);
    return items;
  }

  // Plan SC: FR-R267.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
