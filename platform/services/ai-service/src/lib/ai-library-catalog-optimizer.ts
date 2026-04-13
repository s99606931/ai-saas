// Design Ref: §AI 도서관 카탈로그 최적화
// Plan SC: FR-R630.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type BookCategory = 'literature' | 'science' | 'history' | 'children' | 'tech' | 'art' | 'self_help';

interface BookRecord {
  isbn: string;
  category: BookCategory;
  acquisitionYear: number;
  copies: number;
  totalLoans12m: number;
  lastBorrowedDaysAgo: number;
  conditionScore: number; // 0~100
}

interface OptimizationAction {
  isbn: string;
  action: 'retain' | 'relocate' | 'digitize' | 'discard' | 'acquire_more';
  reason: string;
  priority: number; // 0~100
}

interface CatalogReport {
  totalBooks: number;
  totalCopies: number;
  highDemandCount: number;
  deadStockCount: number;
  actions: OptimizationAction[];
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

export class AILibraryCatalogOptimizer {
  private books = new Map<string, BookRecord>();
  private reports = new Map<string, CatalogReport>();
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R630.1
  registerBook(b: BookRecord, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (b.copies < 0 || b.totalLoans12m < 0) throw new Error('음수 값 불허');
    if (b.conditionScore < 0 || b.conditionScore > 100) throw new Error('상태 점수 범위');
    this.books.set(b.isbn, b);
    this.log('REGISTER_BOOK', { isbn: b.isbn });
  }

  // Plan SC: FR-R630.2
  private loansPerCopy(b: BookRecord): number {
    return b.copies > 0 ? b.totalLoans12m / b.copies : 0;
  }

  // Plan SC: FR-R630.3
  private decideAction(b: BookRecord): OptimizationAction {
    const lpc = this.loansPerCopy(b);
    // dead stock: 365일 이상 미대출
    if (b.lastBorrowedDaysAgo > 365 && lpc < 1) {
      if (b.conditionScore < 40) {
        return { isbn: b.isbn, action: 'discard', reason: '장기 미대출 + 상태 불량', priority: 90 };
      }
      return { isbn: b.isbn, action: 'digitize', reason: '장기 미대출, 디지털 전환 권고', priority: 60 };
    }
    // 고수요: 연 20회 이상/권
    if (lpc >= 20) {
      return {
        isbn: b.isbn,
        action: 'acquire_more',
        reason: `고수요(${lpc.toFixed(1)}회/권), 추가 도서 확보`,
        priority: 85,
      };
    }
    // 중수요 + 오래된 상태 → 재배치
    if (lpc >= 5 && b.conditionScore < 60) {
      return { isbn: b.isbn, action: 'relocate', reason: '재배치로 노출 증대 필요', priority: 50 };
    }
    return { isbn: b.isbn, action: 'retain', reason: '유지', priority: 20 };
  }

  // Plan SC: FR-R630.4
  optimizeCatalog(reportId: string, grade: DataGrade = DataGrade.O): CatalogReport {
    blockClassifiedData(grade);
    const actions: OptimizationAction[] = [];
    let highDemand = 0;
    let deadStock = 0;
    let totalCopies = 0;
    for (const b of this.books.values()) {
      totalCopies += b.copies;
      const lpc = this.loansPerCopy(b);
      if (lpc >= 20) highDemand++;
      if (b.lastBorrowedDaysAgo > 365 && lpc < 1) deadStock++;
      actions.push(this.decideAction(b));
    }
    actions.sort((a, b) => b.priority - a.priority);

    const report: CatalogReport = {
      totalBooks: this.books.size,
      totalCopies,
      highDemandCount: highDemand,
      deadStockCount: deadStock,
      actions,
    };
    this.reports.set(reportId, report);
    this.log('OPTIMIZE', { reportId, highDemand, deadStock });
    return report;
  }

  // Plan SC: FR-R630.5
  getReport(reportId: string): CatalogReport | undefined {
    return this.reports.get(reportId);
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
