// Design Ref: §핵심 알고리즘 — 집행률 계산 + 차기 예산 추천
// Plan SC: FR-R282.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface BudgetItem {
  id: string;
  name: string;
  allocatedAmount: number;
  fiscalYear: number;
}

interface ExpenditureRecord {
  itemId: string;
  amount: number;
  date: string;
}

interface ExecutionResult {
  itemId: string;
  allocatedAmount: number;
  totalSpent: number;
  executionRate: number;
  status: 'under' | 'on_track' | 'over';
}

interface BudgetRecommendation {
  itemId: string;
  currentAllocated: number;
  totalSpent: number;
  recommendedAmount: number;
  basis: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R282.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class BudgetPlanningAssistantAI {
  private items = new Map<string, BudgetItem>();
  private expenditures: ExpenditureRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R282.1
  registerBudgetItem(id: string, name: string, allocatedAmount: number, fiscalYear: number): void {
    if (allocatedAmount < 0) throw new Error('allocatedAmount는 0 이상이어야 합니다');
    this.items.set(id, { id, name, allocatedAmount, fiscalYear });
    this.log('REGISTER_BUDGET_ITEM', { id, name, allocatedAmount, fiscalYear });
  }

  // Plan SC: FR-R282.2
  recordExpenditure(itemId: string, amount: number, date: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.items.has(itemId)) throw new Error(`예산 항목 미등록: ${itemId}`);
    if (amount < 0) throw new Error('amount는 0 이상이어야 합니다');
    this.expenditures.push({ itemId, amount, date });
    this.log('RECORD_EXPENDITURE', { itemId, amount, date });
  }

  // Plan SC: FR-R282.3
  getExecutionRate(itemId: string): ExecutionResult {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`예산 항목 미등록: ${itemId}`);

    const totalSpent = this.expenditures
      .filter(e => e.itemId === itemId)
      .reduce((s, e) => s + e.amount, 0);

    const executionRate = item.allocatedAmount === 0 ? 0 : (totalSpent / item.allocatedAmount) * 100;
    const status: 'under' | 'on_track' | 'over' =
      executionRate > 100 ? 'over' : executionRate >= 80 ? 'on_track' : 'under';

    this.log('GET_EXECUTION_RATE', { itemId, executionRate, status });
    return { itemId, allocatedAmount: item.allocatedAmount, totalSpent, executionRate, status };
  }

  // Plan SC: FR-R282.4
  recommendNextBudget(itemId: string): BudgetRecommendation {
    const result = this.getExecutionRate(itemId);
    const item = this.items.get(itemId)!;

    let recommendedAmount: number;
    let basis: string;

    if (result.status === 'over') {
      recommendedAmount = Math.round(result.totalSpent * 1.1);
      basis = '과집행 110% 기준';
    } else if (result.status === 'on_track') {
      recommendedAmount = Math.round(result.totalSpent * 1.05);
      basis = '정상 집행 105% 기준';
    } else {
      recommendedAmount = Math.round(result.totalSpent * 1.0);
      basis = '미집행 실집행액 기준';
    }

    return { itemId, currentAllocated: item.allocatedAmount, totalSpent: result.totalSpent, recommendedAmount, basis };
  }

  // Plan SC: FR-R282.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
