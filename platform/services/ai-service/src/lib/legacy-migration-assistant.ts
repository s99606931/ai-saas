// 레거시 마이그레이션 AI 어시스턴트 — FR-N408.1~5

export type LegacyLang = 'cobol' | 'c' | 'java6' | 'vb6' | 'delphi' | 'plsql' | 'asp_classic';

export interface LegacyModule {
  id: string;
  name: string;
  language: LegacyLang;
  linesOfCode: number;
  dependencies: string[];
  hasTests: boolean;
  cyclomaticComplexity: number;
}

export interface MigrationTask {
  moduleId: string;
  action: 'rewrite' | 'wrap' | 'retire' | 'lift-shift';
  effortDays: number;
  risk: 'low' | 'medium' | 'high';
  rationale: string;
}

export interface MigrationPlan {
  totalEffortDays: number;
  waves: MigrationTask[][];
  riskDistribution: Record<'low' | 'medium' | 'high', number>;
}

export class LegacyMigrationAssistant {
  analyze(modules: LegacyModule[]): MigrationTask[] {
    if (modules.length === 0) throw new Error('MIGRATION_EMPTY');
    return modules.map((m) => this.analyzeModule(m));
  }

  plan(tasks: MigrationTask[]): MigrationPlan {
    const riskDistribution = { low: 0, medium: 0, high: 0 };
    let totalEffort = 0;
    for (const t of tasks) {
      riskDistribution[t.risk] += 1;
      totalEffort += t.effortDays;
    }
    const waves = this.scheduleWaves(tasks);
    return { totalEffortDays: totalEffort, waves, riskDistribution };
  }

  progress(tasks: MigrationTask[], completedModuleIds: string[]): { completed: number; remaining: number; percent: number } {
    const completed = tasks.filter((t) => completedModuleIds.includes(t.moduleId)).length;
    const remaining = tasks.length - completed;
    const percent = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;
    return { completed, remaining, percent: Number(percent.toFixed(1)) };
  }

  private analyzeModule(m: LegacyModule): MigrationTask {
    const risk = this.assessRisk(m);
    const action = this.chooseAction(m, risk);
    const effortDays = this.estimateEffort(m, action);
    return {
      moduleId: m.id,
      action,
      effortDays,
      risk,
      rationale: this.buildRationale(m, action, risk),
    };
  }

  private assessRisk(m: LegacyModule): 'low' | 'medium' | 'high' {
    let score = 0;
    if (!m.hasTests) score += 2;
    if (m.cyclomaticComplexity > 50) score += 2;
    else if (m.cyclomaticComplexity > 20) score += 1;
    if (m.linesOfCode > 10000) score += 2;
    else if (m.linesOfCode > 2000) score += 1;
    if (m.language === 'cobol' || m.language === 'vb6') score += 1;
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  private chooseAction(m: LegacyModule, risk: 'low' | 'medium' | 'high'): MigrationTask['action'] {
    if (m.linesOfCode < 500 && risk === 'low') return 'retire';
    if (risk === 'high') return 'wrap';
    if (m.hasTests) return 'rewrite';
    return 'lift-shift';
  }

  private estimateEffort(m: LegacyModule, action: MigrationTask['action']): number {
    const basePerKLoc = action === 'rewrite' ? 10 : action === 'wrap' ? 3 : action === 'lift-shift' ? 2 : 1;
    const kloc = m.linesOfCode / 1000;
    const complexityFactor = 1 + m.cyclomaticComplexity / 100;
    return Math.ceil(basePerKLoc * kloc * complexityFactor);
  }

  private buildRationale(m: LegacyModule, action: MigrationTask['action'], risk: 'low' | 'medium' | 'high'): string {
    return `${m.language} ${m.linesOfCode}LOC, 복잡도 ${m.cyclomaticComplexity}, 테스트 ${m.hasTests ? '있음' : '없음'} → ${action} (${risk})`;
  }

  private scheduleWaves(tasks: MigrationTask[]): MigrationTask[][] {
    const low = tasks.filter((t) => t.risk === 'low');
    const medium = tasks.filter((t) => t.risk === 'medium');
    const high = tasks.filter((t) => t.risk === 'high');
    return [low, medium, high].filter((w) => w.length > 0);
  }
}
