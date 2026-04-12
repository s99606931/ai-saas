// Design Ref: §핵심 알고리즘 — WCAG 규칙 평가 + 위반 탐지 + 보고서
// Plan SC: FR-R242.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type Severity = 'critical' | 'error' | 'warning' | 'notice';

interface AccessibilityRule {
  id: string;
  wcagRef: string;
  description: string;
  severity: Severity;
  checkAttribute: string;
  expectedValue: string;
}

interface PageElement {
  elementId: string;
  type: string;
  attributes: Record<string, string>;
}

interface Violation {
  ruleId: string;
  wcagRef: string;
  elementId: string;
  severity: Severity;
  description: string;
  recommendation: string;
}

interface CheckResult {
  pageId: string;
  totalChecks: number;
  violations: Violation[];
}

interface AccessibilityReport {
  pageId: string;
  complianceRate: number;
  totalChecks: number;
  violations: Violation[];
  recommendations: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R242.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class AccessibilityCheckerAI {
  private rules = new Map<string, AccessibilityRule>();
  private checkResults = new Map<string, CheckResult>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R242.1
  registerRule(id: string, wcagRef: string, description: string, severity: Severity = 'warning', checkAttribute: string = '', expectedValue: string = ''): void {
    this.rules.set(id, { id, wcagRef, description, severity, checkAttribute, expectedValue });
    this.log('REGISTER_RULE', { id, wcagRef, severity });
  }

  // Plan SC: FR-R242.2
  checkPage(pageId: string, elements: PageElement[], grade: DataGrade = DataGrade.O): CheckResult {
    guardDataGrade(grade);

    const violations: Violation[] = [];
    let totalChecks = 0;

    for (const element of elements) {
      for (const rule of this.rules.values()) {
        totalChecks++;
        if (!rule.checkAttribute) continue;

        const attrValue = element.attributes[rule.checkAttribute];
        const isMissing = attrValue === undefined || attrValue === '';
        const isMismatch = attrValue !== undefined && rule.expectedValue && attrValue !== rule.expectedValue;

        if (isMissing || isMismatch) {
          violations.push({
            ruleId: rule.id,
            wcagRef: rule.wcagRef,
            elementId: element.elementId,
            severity: rule.severity,
            description: rule.description,
            recommendation: `${element.type} 요소에 ${rule.checkAttribute} 속성 추가 필요`,
          });
        }
      }
    }

    const result: CheckResult = { pageId, totalChecks, violations };
    this.checkResults.set(pageId, result);
    this.log('CHECK_PAGE', { pageId, totalChecks, violationsCount: violations.length });
    return result;
  }

  // Plan SC: FR-R242.3 + R242.4
  getReport(pageId: string): AccessibilityReport {
    const result = this.checkResults.get(pageId);
    if (!result) {
      return { pageId, complianceRate: 100, totalChecks: 0, violations: [], recommendations: [] };
    }

    const severityOrder: Severity[] = ['critical', 'error', 'warning', 'notice'];
    const sortedViolations = [...result.violations].sort(
      (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
    );

    const complianceRate = result.totalChecks === 0
      ? 100
      : Math.round(((result.totalChecks - result.violations.length) / result.totalChecks) * 100);

    const recommendations = sortedViolations.slice(0, 5).map(
      v => `[${v.wcagRef}] ${v.recommendation}`
    );

    this.log('GET_REPORT', { pageId, complianceRate });
    return { pageId, complianceRate, totalChecks: result.totalChecks, violations: sortedViolations, recommendations };
  }

  // Plan SC: FR-R242.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
