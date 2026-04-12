// Design Ref: MTU-N414 §정부 예산집행 분석
// Plan SC: FR-N414.1~5

export interface BudgetLineItem {
  itemId: string;
  category: string;
  plannedAmount: number;
  fiscalYear: number;
}

export interface Expenditure {
  txId: string;
  itemId: string;
  amount: number;
  date: string;
  vendor?: string;
  description?: string;
}

export interface ExecutionPace {
  itemId: string;
  plannedAmount: number;
  executedAmount: number;
  executionRate: number;
  expectedRateAtDate: number;
  lagDelta: number;
  status: 'ontrack' | 'lagging' | 'overspent';
}

export interface Anomaly {
  txId: string;
  itemId: string;
  kind: 'spike' | 'category-violation' | 'duplicate';
  severity: 'low' | 'med' | 'high';
  note: string;
}

export interface SavingSuggestion {
  itemId: string;
  reason: string;
  estimatedSaving: number;
}

export class GovBudgetExecution {
  /** FR-N414.1 집행 속도 */
  calcPace(
    items: BudgetLineItem[],
    expenditures: Expenditure[],
    asOfDayOfYear: number,
  ): ExecutionPace[] {
    const expected = Math.min(1, asOfDayOfYear / 365);
    return items.map((it) => {
      const executed = expenditures
        .filter((e) => e.itemId === it.itemId)
        .reduce((s, e) => s + e.amount, 0);
      const executionRate = it.plannedAmount > 0 ? +(executed / it.plannedAmount).toFixed(3) : 0;
      const lagDelta = +(executionRate - expected).toFixed(3);
      let status: ExecutionPace['status'] = 'ontrack';
      if (executionRate > 1) status = 'overspent';
      else if (lagDelta < -0.15) status = 'lagging';
      return {
        itemId: it.itemId,
        plannedAmount: it.plannedAmount,
        executedAmount: executed,
        executionRate,
        expectedRateAtDate: +expected.toFixed(3),
        lagDelta,
        status,
      };
    });
  }

  /** FR-N414.2 이상 지출 탐지 */
  detectAnomalies(
    items: BudgetLineItem[],
    expenditures: Expenditure[],
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const byItem = new Map<string, Expenditure[]>();
    for (const e of expenditures) {
      const arr = byItem.get(e.itemId) ?? [];
      arr.push(e);
      byItem.set(e.itemId, arr);
    }

    for (const [itemId, list] of byItem.entries()) {
      const item = items.find((i) => i.itemId === itemId);
      if (!item) continue;
      const amounts = list.map((e) => e.amount);
      const mean = amounts.reduce((s, v) => s + v, 0) / Math.max(1, amounts.length);
      const max = Math.max(...amounts);
      for (const e of list) {
        if (e.amount > mean * 5 && e.amount === max) {
          anomalies.push({
            txId: e.txId,
            itemId,
            kind: 'spike',
            severity: 'high',
            note: `평균 대비 ${(e.amount / Math.max(1, mean)).toFixed(1)}배 급증`,
          });
        }
      }

      const executed = amounts.reduce((s, v) => s + v, 0);
      if (executed > item.plannedAmount) {
        for (const e of list.slice(-1)) {
          anomalies.push({
            txId: e.txId,
            itemId,
            kind: 'category-violation',
            severity: 'high',
            note: '계획 초과 집행',
          });
        }
      }

      const seen = new Map<string, number>();
      for (const e of list) {
        const key = `${e.vendor ?? ''}|${e.amount}|${e.date}`;
        const cnt = (seen.get(key) ?? 0) + 1;
        seen.set(key, cnt);
        if (cnt > 1) {
          anomalies.push({
            txId: e.txId,
            itemId,
            kind: 'duplicate',
            severity: 'med',
            note: '동일 벤더/금액/날짜 중복',
          });
        }
      }
    }
    return anomalies;
  }

  /** FR-N414.3 절감 기회 */
  suggestSavings(pace: ExecutionPace[]): SavingSuggestion[] {
    const out: SavingSuggestion[] = [];
    for (const p of pace) {
      if (p.status === 'lagging' && p.lagDelta < -0.3) {
        const save = +((p.plannedAmount - p.executedAmount) * 0.2).toFixed(0);
        out.push({
          itemId: p.itemId,
          reason: '집행 지연 심각 — 예산 재배분 검토',
          estimatedSaving: save,
        });
      }
      if (p.status === 'overspent') {
        out.push({
          itemId: p.itemId,
          reason: '초과 집행 — 향후 신규 계약 억제',
          estimatedSaving: 0,
        });
      }
    }
    return out;
  }

  /** FR-N414.4 불용액 예측 */
  forecastUnused(pace: ExecutionPace[]): Array<{ itemId: string; forecastUnused: number }> {
    return pace.map((p) => {
      const remaining = p.plannedAmount - p.executedAmount;
      const expectedExtra = p.plannedAmount * (1 - p.expectedRateAtDate) * (1 + p.lagDelta);
      const unused = Math.max(0, remaining - expectedExtra);
      return { itemId: p.itemId, forecastUnused: +unused.toFixed(0) };
    });
  }

  /** FR-N414.5 투명성 리포트 */
  buildTransparencyReport(pace: ExecutionPace[], anomalies: Anomaly[]): string {
    const lines: string[] = ['# 예산 집행 투명성 리포트'];
    const onTrack = pace.filter((p) => p.status === 'ontrack').length;
    lines.push(`- 총 항목: ${pace.length}`);
    lines.push(`- 정상 집행: ${onTrack}`);
    lines.push(`- 이상 거래: ${anomalies.length}`);
    lines.push('\n## 집행 상태');
    for (const p of pace) {
      lines.push(
        `- ${p.itemId}: ${(p.executionRate * 100).toFixed(1)}% (${p.status})`,
      );
    }
    return lines.join('\n');
  }
}

export const govBudgetExecution = new GovBudgetExecution();
