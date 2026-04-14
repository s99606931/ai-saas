// Design Ref: §SVC-AI-ADV-R514 — AI기반 공공 서비스 접근성 평가 v3
// Plan SC: FR-R514.1~5

export type AccessibilityGrade = 'A' | 'B' | 'C' | 'D';

export interface AccessibilityCheck {
  readonly serviceId: string;
  readonly hasAltText: boolean;
  readonly hasKeyboardNav: boolean;
  readonly hasColorContrast: boolean;
  readonly hasCaptionVideo: boolean;
  readonly hasScreenReader: boolean;
}

export interface AccessibilityResult {
  readonly serviceId: string;
  readonly score: number;
  readonly grade: AccessibilityGrade;
  readonly missing: readonly string[];
}

const CRITERIA: Array<{ key: keyof Omit<AccessibilityCheck, 'serviceId'>; label: string }> = [
  { key: 'hasAltText', label: 'altText' },
  { key: 'hasKeyboardNav', label: 'keyboardNav' },
  { key: 'hasColorContrast', label: 'colorContrast' },
  { key: 'hasCaptionVideo', label: 'captionVideo' },
  { key: 'hasScreenReader', label: 'screenReader' },
];

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class PublicServiceAccessibilityAssessorV3 {
  private readonly auditLog: AuditEvent[] = [];

  assess(checks: readonly AccessibilityCheck[]): readonly AccessibilityResult[] {
    const results: AccessibilityResult[] = checks.map(check => {
      const missing = CRITERIA.filter(c => !check[c.key]).map(c => c.label);
      const score = (CRITERIA.length - missing.length) * 20;
      const grade: AccessibilityGrade =
        score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
      return { serviceId: check.serviceId, score, grade, missing };
    });

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'accessibility.assess',
      details: {
        serviceCount: checks.length,
        gradeACount: results.filter(r => r.grade === 'A').length,
        gradeDCount: results.filter(r => r.grade === 'D').length,
      },
    });

    return results;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
