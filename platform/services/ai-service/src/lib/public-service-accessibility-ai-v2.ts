// Design Ref: SVC-AI-ADV-R673.design.md — AI기반 공공서비스 접근성 향상 v2
// Plan SC: FR-R673.1~5

export type AccessSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';
export type AccessAction = 'BACKLOG' | 'FIX_NOW' | 'BLOCK_RELEASE';

interface Page { pageId: string; url: string; wcagLevel: 'A' | 'AA' | 'AAA' }
interface AccessibilityIssue {
  issueId: string;
  pageId: string;
  wcagViolations: number;
}
interface AccessReport {
  issueId: string;
  pageId: string;
  severity: AccessSeverity;
  action: AccessAction;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const ACTION_RANK: AccessAction[] = ['BACKLOG', 'FIX_NOW', 'BLOCK_RELEASE'];

function rankToAction(rank: number): AccessAction {
  const idx = Math.max(0, Math.min(ACTION_RANK.length - 1, rank));
  return ACTION_RANK[idx]!;
}

export class PublicServiceAccessibilityAIV2 {
  private pages = new Map<string, Page>();
  private reports: AccessReport[] = [];
  private auditLog: AuditEntry[] = [];

  registerPage(page: Page): void {
    this.pages.set(page.pageId, page);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_PAGE',
      details: { pageId: page.pageId, url: page.url, wcagLevel: page.wcagLevel },
    });
  }

  reportIssue(issue: AccessibilityIssue, dataGrade?: string): AccessReport {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const page = this.pages.get(issue.pageId);
    if (!page) {
      throw new Error(`UNKNOWN_PAGE: ${issue.pageId}`);
    }
    if (issue.wcagViolations < 0) {
      throw new Error('INVALID_VIOLATIONS');
    }

    let severity: AccessSeverity;
    let baseRank: number;
    if (issue.wcagViolations >= 3) {
      severity = 'CRITICAL';
      baseRank = 2;
    } else if (issue.wcagViolations === 2) {
      severity = 'MAJOR';
      baseRank = 1;
    } else {
      severity = 'MINOR';
      baseRank = 0;
    }

    const finalRank = page.wcagLevel === 'A' ? baseRank + 1 : baseRank;
    const action = rankToAction(finalRank);

    const report: AccessReport = { issueId: issue.issueId, pageId: issue.pageId, severity, action };
    this.reports.push(report);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REPORT_ISSUE',
      details: { issueId: issue.issueId, pageId: issue.pageId, severity, action },
    });
    return report;
  }

  getBlockingReports(): AccessReport[] {
    return this.reports.filter((r) => r.action === 'BLOCK_RELEASE');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
