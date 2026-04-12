// 플랫폼 엔지니어링 메트릭 (DORA + SPACE + DX) — FR-N404.1~5

export interface DoraInputs {
  deployments: number;
  leadTimeHours: number[];
  changeFailureCount: number;
  mttrMinutes: number[];
  days: number;
}

export interface SpaceInputs {
  satisfactionSurvey: number; // 1..5
  prsMerged: number;
  incidentsResolved: number;
  codeReviewsGiven: number;
  focusHours: number;
  teamSize: number;
  days: number;
}

export interface DoraReport {
  deploymentFrequencyPerDay: number;
  leadTimeMedianHours: number;
  changeFailureRate: number;
  mttrMedianMinutes: number;
  level: 'elite' | 'high' | 'medium' | 'low';
}

export interface SpaceReport {
  satisfaction: number;
  performance: number;
  activity: number;
  communication: number;
  efficiency: number;
  overall: number;
}

export class PlatformMetrics {
  computeDora(input: DoraInputs): DoraReport {
    if (input.days <= 0) throw new Error('METRICS_INVALID_DAYS');
    const freq = input.deployments / input.days;
    const leadMed = this.median(input.leadTimeHours);
    const cfr = input.deployments > 0 ? input.changeFailureCount / input.deployments : 0;
    const mttrMed = this.median(input.mttrMinutes);
    return {
      deploymentFrequencyPerDay: Number(freq.toFixed(3)),
      leadTimeMedianHours: Number(leadMed.toFixed(2)),
      changeFailureRate: Number(cfr.toFixed(3)),
      mttrMedianMinutes: Number(mttrMed.toFixed(1)),
      level: this.classifyDora(freq, leadMed, cfr, mttrMed),
    };
  }

  computeSpace(input: SpaceInputs): SpaceReport {
    if (input.teamSize <= 0 || input.days <= 0) throw new Error('METRICS_INVALID_TEAM');
    const satisfaction = Math.max(0, Math.min(1, (input.satisfactionSurvey - 1) / 4));
    const performance = Math.min(1, input.prsMerged / (input.teamSize * input.days * 0.3));
    const activity = Math.min(1, input.codeReviewsGiven / (input.teamSize * input.days));
    const communication = Math.min(1, input.incidentsResolved / Math.max(1, input.prsMerged * 0.1));
    const efficiency = Math.min(1, input.focusHours / (input.teamSize * input.days * 4));
    const overall = (satisfaction + performance + activity + communication + efficiency) / 5;
    return {
      satisfaction: Number(satisfaction.toFixed(3)),
      performance: Number(performance.toFixed(3)),
      activity: Number(activity.toFixed(3)),
      communication: Number(communication.toFixed(3)),
      efficiency: Number(efficiency.toFixed(3)),
      overall: Number(overall.toFixed(3)),
    };
  }

  computeDxIndex(space: SpaceReport, dora: DoraReport): number {
    const doraScore =
      (dora.level === 'elite' ? 1 : dora.level === 'high' ? 0.75 : dora.level === 'medium' ? 0.5 : 0.25);
    return Number(((space.overall * 0.6 + doraScore * 0.4)).toFixed(3));
  }

  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }

  private classifyDora(
    freqPerDay: number,
    leadHours: number,
    cfr: number,
    mttrMin: number,
  ): DoraReport['level'] {
    if (freqPerDay >= 1 && leadHours < 24 && cfr < 0.15 && mttrMin < 60) return 'elite';
    if (freqPerDay >= 0.3 && leadHours < 168 && cfr < 0.3 && mttrMin < 240) return 'high';
    if (freqPerDay >= 0.1 && leadHours < 720 && cfr < 0.45) return 'medium';
    return 'low';
  }
}
