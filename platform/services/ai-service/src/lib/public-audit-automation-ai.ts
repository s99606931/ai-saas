// Design Ref: §핵심 알고리즘 — 가중치 기반 준수율 + 우선순위 정렬
// Plan SC: FR-R221.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ChecklistItem {
  id: string;
  category: string;
  description: string;
  weight: number;
}

interface AuditEventRecord {
  itemId: string;
  passed: boolean;
  evidence: string;
  timestamp: string;
}

interface ItemComplianceResult {
  itemId: string;
  passed: boolean;
  evidence: string;
  lastCheckedAt: string | null;
}

interface FailedItem {
  itemId: string;
  category: string;
  description: string;
  weight: number;
  evidence: string;
}

interface AuditReport {
  complianceRate: number;
  totalItems: number;
  passedCount: number;
  failedCount: number;
  passedItems: string[];
  failedItems: FailedItem[];
  recommendations: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R221.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class PublicAuditAutomationAI {
  private checklist = new Map<string, ChecklistItem>();
  private auditEvents: AuditEventRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R221.1
  registerChecklistItem(id: string, category: string, description: string, weight: number = 1): void {
    this.checklist.set(id, { id, category, description, weight });
    this.log('REGISTER_CHECKLIST_ITEM', { id, category, weight });
  }

  // Plan SC: FR-R221.2
  recordAuditEvent(itemId: string, passed: boolean, evidence: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);

    if (!this.checklist.has(itemId)) {
      throw new Error(`체크리스트 항목 미등록: ${itemId}`);
    }

    this.auditEvents.push({ itemId, passed, evidence, timestamp: new Date().toISOString() });
    this.log('RECORD_AUDIT_EVENT', { itemId, passed });
  }

  // Plan SC: FR-R221.3
  checkCompliance(itemId: string): ItemComplianceResult {
    const events = this.auditEvents
      .filter(e => e.itemId === itemId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (events.length === 0) {
      return { itemId, passed: false, evidence: '이벤트 없음', lastCheckedAt: null };
    }

    const latest = events[0]!;
    return {
      itemId,
      passed: latest.passed,
      evidence: latest.evidence,
      lastCheckedAt: latest.timestamp,
    };
  }

  // Plan SC: FR-R221.4
  generateReport(): AuditReport {
    const items = Array.from(this.checklist.values());
    if (items.length === 0) {
      return {
        complianceRate: 0,
        totalItems: 0,
        passedCount: 0,
        failedCount: 0,
        passedItems: [],
        failedItems: [],
        recommendations: [],
      };
    }

    let totalWeight = 0;
    let passedWeight = 0;
    const passedItems: string[] = [];
    const failedItems: FailedItem[] = [];

    for (const item of items) {
      const compliance = this.checkCompliance(item.id);
      totalWeight += item.weight;

      if (compliance.passed) {
        passedWeight += item.weight;
        passedItems.push(item.id);
      } else {
        failedItems.push({
          itemId: item.id,
          category: item.category,
          description: item.description,
          weight: item.weight,
          evidence: compliance.evidence,
        });
      }
    }

    failedItems.sort((a, b) => b.weight - a.weight);

    const complianceRate = totalWeight === 0 ? 0 : Math.round((passedWeight / totalWeight) * 100);

    const categoryFailures = new Map<string, number>();
    for (const item of failedItems) {
      categoryFailures.set(item.category, (categoryFailures.get(item.category) ?? 0) + 1);
    }
    const recommendations = Array.from(categoryFailures.entries()).map(
      ([category, count]) => `[${category}] ${count}개 항목 미흡 — 해당 카테고리 개선 필요`
    );

    this.log('GENERATE_REPORT', { complianceRate, passedCount: passedItems.length, failedCount: failedItems.length });
    return {
      complianceRate,
      totalItems: items.length,
      passedCount: passedItems.length,
      failedCount: failedItems.length,
      passedItems,
      failedItems,
      recommendations,
    };
  }

  // Plan SC: FR-R221.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
