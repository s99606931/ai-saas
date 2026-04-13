// Design Ref: §핵심 알고리즘 — 도서 수요 예측 및 운영 최적화
// Plan SC: FR-R513.1~5

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

interface BookCirculation {
  bookId: string;
  category: string;
  monthYYYYMM: string;
  loanCount: number;
  reservationCount: number;
}

interface DemandForecast {
  bookId: string;
  category: string;
  forecastNextMonthLoans: number;
  trend: 'up' | 'flat' | 'down';
}

interface InventoryAdvice {
  bookId: string;
  action: 'acquire' | 'maintain' | 'reduce';
  suggestedCopies: number;
  reason: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AIPublicLibraryOptimizer {
  private circulations: BookCirculation[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R513.1
  recordCirculation(record: BookCirculation, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    this.circulations.push(record);
    this.appendAudit('RECORD_CIRCULATION', { bookId: record.bookId, monthYYYYMM: record.monthYYYYMM });
  }

  // Plan SC: FR-R513.2
  forecastDemand(bookId: string): DemandForecast {
    const records = this.circulations
      .filter(r => r.bookId === bookId)
      .sort((a, b) => a.monthYYYYMM.localeCompare(b.monthYYYYMM));
    if (records.length === 0) throw new Error(`도서 기록 없음: ${bookId}`);

    const lastIdx = records.length - 1;
    const last = records[lastIdx]!;
    const recent3 = records.slice(-3);
    const avgRecent = recent3.reduce((sum, r) => sum + r.loanCount, 0) / recent3.length;

    let trend: 'up' | 'flat' | 'down' = 'flat';
    if (records.length >= 2) {
      const prev = records[lastIdx - 1]!;
      if (last.loanCount > prev.loanCount * 1.1) trend = 'up';
      else if (last.loanCount < prev.loanCount * 0.9) trend = 'down';
    }

    const reservationBoost = last.reservationCount * 0.5;
    const forecast = Math.round(avgRecent + reservationBoost);

    this.appendAudit('FORECAST_DEMAND', { bookId, forecast, trend });
    return { bookId, category: last.category, forecastNextMonthLoans: forecast, trend };
  }

  // Plan SC: FR-R513.3
  adviseInventory(bookId: string, currentCopies: number): InventoryAdvice {
    const forecast = this.forecastDemand(bookId);
    let action: 'acquire' | 'maintain' | 'reduce';
    let suggestedCopies = currentCopies;
    let reason: string;

    const utilizationTarget = 4; // 권당 월 4건 대출 목표
    const requiredCopies = Math.max(1, Math.ceil(forecast.forecastNextMonthLoans / utilizationTarget));

    if (requiredCopies > currentCopies + 1) {
      action = 'acquire';
      suggestedCopies = requiredCopies;
      reason = `예측 수요 ${forecast.forecastNextMonthLoans}건, 추가 ${requiredCopies - currentCopies}권 권장`;
    } else if (requiredCopies < currentCopies - 2) {
      action = 'reduce';
      suggestedCopies = requiredCopies;
      reason = `예측 수요 ${forecast.forecastNextMonthLoans}건, ${currentCopies - requiredCopies}권 감축`;
    } else {
      action = 'maintain';
      reason = '현재 보유량 적정';
    }

    this.appendAudit('ADVISE_INVENTORY', { bookId, action, suggestedCopies });
    return { bookId, action, suggestedCopies, reason };
  }

  // Plan SC: FR-R513.4
  rankPopularCategories(monthYYYYMM: string, topN: number = 5): Array<{ category: string; loans: number }> {
    const monthly = this.circulations.filter(r => r.monthYYYYMM === monthYYYYMM);
    const map = new Map<string, number>();
    for (const r of monthly) {
      map.set(r.category, (map.get(r.category) ?? 0) + r.loanCount);
    }
    const arr = Array.from(map.entries())
      .map(([category, loans]) => ({ category, loans }))
      .sort((a, b) => b.loans - a.loans)
      .slice(0, topN);
    this.appendAudit('RANK_CATEGORIES', { monthYYYYMM, topN });
    return arr;
  }

  // Plan SC: FR-R513.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
