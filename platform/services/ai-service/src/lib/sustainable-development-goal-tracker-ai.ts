// Design Ref: §SDG 17목표 진행률 추적 + 추세 분석
// Plan SC: FR-R618.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type SDGGoal =
  | 'SDG01' | 'SDG02' | 'SDG03' | 'SDG04' | 'SDG05'
  | 'SDG06' | 'SDG07' | 'SDG08' | 'SDG09' | 'SDG10'
  | 'SDG11' | 'SDG12' | 'SDG13' | 'SDG14' | 'SDG15'
  | 'SDG16' | 'SDG17';

interface IndicatorReport {
  goal: SDGGoal;
  indicatorCode: string;
  year: number;
  value: number;
  targetValue: number;
  unit: string;
}

interface GoalProgress {
  goal: SDGGoal;
  indicatorCount: number;
  achievementRatio: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class SustainableDevelopmentGoalTrackerAI {
  private reports: IndicatorReport[] = [];
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R618.1
  recordReport(report: IndicatorReport, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (report.targetValue <= 0) throw new Error('목표치는 양수여야 합니다');
    this.reports.push(report);
    this.log('RECORD_REPORT', { goal: report.goal, indicator: report.indicatorCode, year: report.year });
  }

  // Plan SC: FR-R618.2
  private achievement(report: IndicatorReport): number {
    return Math.max(0, Math.min(1, report.value / report.targetValue));
  }

  // Plan SC: FR-R618.3
  private detectTrend(goal: SDGGoal): GoalProgress['trend'] {
    const goalReports = this.reports.filter(r => r.goal === goal);
    if (goalReports.length < 2) return 'stable';

    // 지표별 연도순 정렬 후 최신 2개 비교
    const byIndicator = new Map<string, IndicatorReport[]>();
    for (const r of goalReports) {
      const list = byIndicator.get(r.indicatorCode) ?? [];
      list.push(r);
      byIndicator.set(r.indicatorCode, list);
    }

    let improving = 0;
    let declining = 0;
    for (const list of byIndicator.values()) {
      list.sort((a, b) => a.year - b.year);
      if (list.length < 2) continue;
      const latest = list[list.length - 1];
      const prev = list[list.length - 2];
      if (!latest || !prev) continue;
      const latestAch = this.achievement(latest);
      const prevAch = this.achievement(prev);
      if (latestAch > prevAch + 0.02) improving += 1;
      else if (latestAch < prevAch - 0.02) declining += 1;
    }

    if (improving > declining) return 'improving';
    if (declining > improving) return 'declining';
    return 'stable';
  }

  // Plan SC: FR-R618.4
  computeGoalProgress(goal: SDGGoal, grade: DataGrade = DataGrade.O): GoalProgress {
    blockClassifiedData(grade);
    const goalReports = this.reports.filter(r => r.goal === goal);

    // 지표별 최신 연도 기준 달성률
    const byIndicator = new Map<string, IndicatorReport>();
    for (const r of goalReports) {
      const existing = byIndicator.get(r.indicatorCode);
      if (!existing || existing.year < r.year) {
        byIndicator.set(r.indicatorCode, r);
      }
    }

    let achievementSum = 0;
    for (const r of byIndicator.values()) {
      achievementSum += this.achievement(r);
    }
    const count = byIndicator.size;
    const ratio = count === 0 ? 0 : achievementSum / count;

    const progress: GoalProgress = {
      goal,
      indicatorCount: count,
      achievementRatio: Math.round(ratio * 1000) / 1000,
      trend: this.detectTrend(goal),
    };
    this.log('COMPUTE_GOAL_PROGRESS', { goal, ratio: progress.achievementRatio });
    return progress;
  }

  // Plan SC: FR-R618.5
  listLaggingGoals(threshold: number = 0.5): SDGGoal[] {
    const goals: SDGGoal[] = [
      'SDG01','SDG02','SDG03','SDG04','SDG05','SDG06','SDG07','SDG08','SDG09',
      'SDG10','SDG11','SDG12','SDG13','SDG14','SDG15','SDG16','SDG17',
    ];
    const lagging: SDGGoal[] = [];
    for (const g of goals) {
      const p = this.computeGoalProgress(g);
      if (p.indicatorCount > 0 && p.achievementRatio < threshold) lagging.push(g);
    }
    this.log('LIST_LAGGING', { count: lagging.length });
    return lagging;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
