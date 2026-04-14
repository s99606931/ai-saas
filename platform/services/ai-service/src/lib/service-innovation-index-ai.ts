// Design Ref: §혁신지수 산출 — digitalServiceRate×0.3+processAutomation×0.3+dataOpen×0.2+satisfaction×0.2
// Plan SC: SC-R538-1, SC-R538-2, SC-R538-3

interface InnovationInput {
  agencyId: string;
  digitalServiceRate: number;
  processAutomationRate: number;
  dataOpenRate: number;
  citizenSatisfaction: number;
}

type InnovationGrade = 'INNOVATING' | 'ADVANCING' | 'DEVELOPING' | 'LAGGING';

interface InnovationResult {
  agencyId: string;
  innovationIndex: number;
  grade: InnovationGrade;
  lowestMetric: string;
  recommendation: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  agencyId: string;
  grade: InnovationGrade;
  innovationIndex: number;
}

export class ServiceInnovationIndexAI {
  private readonly auditLog: AuditEntry[] = [];

  analyze(input: InnovationInput): InnovationResult {
    const { agencyId, digitalServiceRate, processAutomationRate, dataOpenRate, citizenSatisfaction } = input;

    const innovationIndex =
      digitalServiceRate * 0.3 +
      processAutomationRate * 0.3 +
      dataOpenRate * 0.2 +
      citizenSatisfaction * 0.2;

    const grade = this.classifyGrade(innovationIndex);
    const lowestMetric = this.findLowestMetric(digitalServiceRate, processAutomationRate, dataOpenRate, citizenSatisfaction);
    const recommendation = this.buildRecommendation(lowestMetric, grade);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'INNOVATION_ANALYZED',
      agencyId,
      grade,
      innovationIndex: Math.round(innovationIndex * 100) / 100,
    });

    return { agencyId, innovationIndex: Math.round(innovationIndex * 100) / 100, grade, lowestMetric, recommendation };
  }

  private classifyGrade(index: number): InnovationGrade {
    if (index >= 80) return 'INNOVATING';
    if (index >= 60) return 'ADVANCING';
    if (index >= 40) return 'DEVELOPING';
    return 'LAGGING';
  }

  private findLowestMetric(digital: number, automation: number, dataOpen: number, satisfaction: number): string {
    const metrics = [
      { name: 'digitalServiceRate', value: digital },
      { name: 'processAutomationRate', value: automation },
      { name: 'dataOpenRate', value: dataOpen },
      { name: 'citizenSatisfaction', value: satisfaction },
    ];
    return metrics.reduce((a, b) => (a.value <= b.value ? a : b)).name;
  }

  private buildRecommendation(lowestMetric: string, grade: InnovationGrade): string {
    if (grade === 'INNOVATING') return '현재 혁신 수준을 유지하십시오.';
    return `${lowestMetric} 지표 개선이 우선 과제입니다.`;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
