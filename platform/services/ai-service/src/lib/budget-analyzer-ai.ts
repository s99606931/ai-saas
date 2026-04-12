// 공공기관 예산 AI 분석 — FR-N396.1~5

export type AccountType = 'revenue' | 'expense';

export interface BudgetLineItem {
  accountCode: string;
  accountName: string;
  type: AccountType;
  planned: number;
  executed: number;
  fiscalYear: number;
  category: string;
}

export interface BudgetAnalysis {
  totalPlanned: number;
  totalExecuted: number;
  executionRate: number;
  byCategory: Record<string, { planned: number; executed: number; rate: number }>;
  anomalies: BudgetAnomaly[];
  summary: string;
}

export interface BudgetAnomaly {
  accountCode: string;
  accountName: string;
  kind: 'over_budget' | 'under_execution' | 'yoy_spike' | 'yoy_drop';
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

export interface YoyCompare {
  previous: BudgetLineItem[];
  current: BudgetLineItem[];
}

export class BudgetAnalyzerAi {
  analyze(items: BudgetLineItem[]): BudgetAnalysis {
    if (items.length === 0) throw new Error('BUDGET_EMPTY');
    const expenses = items.filter((i) => i.type === 'expense');
    const totalPlanned = expenses.reduce((s, i) => s + i.planned, 0);
    const totalExecuted = expenses.reduce((s, i) => s + i.executed, 0);
    const executionRate = totalPlanned > 0 ? totalExecuted / totalPlanned : 0;

    const byCategory: Record<string, { planned: number; executed: number; rate: number }> = {};
    for (const item of expenses) {
      const existing = byCategory[item.category] ?? { planned: 0, executed: 0, rate: 0 };
      existing.planned += item.planned;
      existing.executed += item.executed;
      existing.rate = existing.planned > 0 ? existing.executed / existing.planned : 0;
      byCategory[item.category] = existing;
    }

    const anomalies = this.detectAnomalies(expenses);
    const summary = this.summarize(executionRate, anomalies.length, totalPlanned, totalExecuted);

    return {
      totalPlanned,
      totalExecuted,
      executionRate: Number(executionRate.toFixed(4)),
      byCategory,
      anomalies,
      summary,
    };
  }

  compareYoy(compare: YoyCompare): BudgetAnomaly[] {
    const prevMap = new Map<string, BudgetLineItem>();
    for (const p of compare.previous) prevMap.set(p.accountCode, p);
    const out: BudgetAnomaly[] = [];
    for (const cur of compare.current) {
      const prev = prevMap.get(cur.accountCode);
      if (!prev) continue;
      if (prev.planned === 0) continue;
      const change = (cur.planned - prev.planned) / prev.planned;
      if (change >= 0.5) {
        out.push({
          accountCode: cur.accountCode,
          accountName: cur.accountName,
          kind: 'yoy_spike',
          severity: change >= 1 ? 'high' : 'medium',
          detail: `전년 대비 ${(change * 100).toFixed(1)}% 증가`,
        });
      } else if (change <= -0.5) {
        out.push({
          accountCode: cur.accountCode,
          accountName: cur.accountName,
          kind: 'yoy_drop',
          severity: change <= -0.8 ? 'high' : 'medium',
          detail: `전년 대비 ${(change * 100).toFixed(1)}% 감소`,
        });
      }
    }
    return out;
  }

  private detectAnomalies(items: BudgetLineItem[]): BudgetAnomaly[] {
    const out: BudgetAnomaly[] = [];
    for (const item of items) {
      if (item.planned === 0) continue;
      const rate = item.executed / item.planned;
      if (rate > 1.1) {
        out.push({
          accountCode: item.accountCode,
          accountName: item.accountName,
          kind: 'over_budget',
          severity: rate > 1.5 ? 'high' : 'medium',
          detail: `집행률 ${(rate * 100).toFixed(1)}%`,
        });
      } else if (rate < 0.3) {
        out.push({
          accountCode: item.accountCode,
          accountName: item.accountName,
          kind: 'under_execution',
          severity: rate < 0.1 ? 'high' : 'low',
          detail: `집행률 ${(rate * 100).toFixed(1)}%`,
        });
      }
    }
    return out;
  }

  private summarize(rate: number, anomalyCount: number, planned: number, executed: number): string {
    const pct = (rate * 100).toFixed(1);
    const lines = [
      `총 예산 ${planned.toLocaleString('ko-KR')}원, 집행 ${executed.toLocaleString('ko-KR')}원`,
      `전체 집행률 ${pct}%`,
      anomalyCount > 0 ? `이상 항목 ${anomalyCount}건 탐지` : '이상 항목 없음',
    ];
    return lines.join(' / ');
  }
}
