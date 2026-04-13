// Design Ref: §핵심 알고리즘 — 품질 규칙 적용 + 수정 제안
// Plan SC: FR-R264.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type RuleType = 'not_null' | 'range' | 'format' | 'enum';

interface QualityRule {
  id: string;
  field: string;
  ruleType: RuleType;
  params: Record<string, unknown>;
}

interface QualityIssue {
  field: string;
  ruleId: string;
  issueType: RuleType;
  currentValue: unknown;
  message: string;
}

interface InspectionResult {
  recordId: string;
  issues: QualityIssue[];
  qualityScore: number;
}

interface FixSuggestion {
  field: string;
  issueType: RuleType;
  suggestedValue: unknown;
  confidence: 'high' | 'medium' | 'low';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R264.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class AutoDataQualityImprover {
  private rules = new Map<string, QualityRule>();
  private inspectionResults = new Map<string, InspectionResult>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R264.1
  registerRule(id: string, field: string, ruleType: RuleType, params: Record<string, unknown> = {}): void {
    this.rules.set(id, { id, field, ruleType, params });
    this.log('REGISTER_RULE', { id, field, ruleType });
  }

  // Plan SC: FR-R264.2 + R264.3
  inspectRecord(recordId: string, data: Record<string, unknown>, grade: DataGrade = DataGrade.O): InspectionResult {
    guardDataGrade(grade);

    const issues: QualityIssue[] = [];

    for (const rule of this.rules.values()) {
      const value = data[rule.field];

      if (rule.ruleType === 'not_null') {
        if (value === undefined || value === null || value === '') {
          issues.push({ field: rule.field, ruleId: rule.id, issueType: 'not_null', currentValue: value, message: `${rule.field}: 필수 값 누락` });
        }
      } else if (rule.ruleType === 'range') {
        const num = Number(value);
        if (!isNaN(num)) {
          const min = Number(rule.params['min'] ?? -Infinity);
          const max = Number(rule.params['max'] ?? Infinity);
          if (num < min || num > max) {
            issues.push({ field: rule.field, ruleId: rule.id, issueType: 'range', currentValue: value, message: `${rule.field}: 범위 초과 (${min}~${max})` });
          }
        }
      } else if (rule.ruleType === 'format') {
        const pattern = rule.params['pattern'] as string;
        if (pattern && typeof value === 'string' && !new RegExp(pattern).test(value)) {
          issues.push({ field: rule.field, ruleId: rule.id, issueType: 'format', currentValue: value, message: `${rule.field}: 형식 불일치 (${pattern})` });
        }
      } else if (rule.ruleType === 'enum') {
        const allowed = rule.params['values'] as unknown[];
        if (allowed && !allowed.includes(value)) {
          issues.push({ field: rule.field, ruleId: rule.id, issueType: 'enum', currentValue: value, message: `${rule.field}: 허용 값 아님` });
        }
      }
    }

    const qualityScore = this.rules.size === 0 ? 100 : Math.round(((this.rules.size - issues.length) / this.rules.size) * 100);
    const result: InspectionResult = { recordId, issues, qualityScore };
    this.inspectionResults.set(recordId, result);
    this.log('INSPECT_RECORD', { recordId, issuesCount: issues.length, qualityScore });
    return result;
  }

  // Plan SC: FR-R264.4
  suggestFix(recordId: string, fieldName: string): FixSuggestion | null {
    const result = this.inspectionResults.get(recordId);
    if (!result) return null;

    const issue = result.issues.find(i => i.field === fieldName);
    if (!issue) return null;

    const rule = this.rules.get(issue.ruleId);
    if (!rule) return null;

    if (issue.issueType === 'not_null') {
      return { field: fieldName, issueType: 'not_null', suggestedValue: '', confidence: 'low' };
    } else if (issue.issueType === 'range') {
      const min = Number(rule.params['min'] ?? 0);
      return { field: fieldName, issueType: 'range', suggestedValue: min, confidence: 'medium' };
    } else if (issue.issueType === 'enum') {
      const values = rule.params['values'] as unknown[];
      return { field: fieldName, issueType: 'enum', suggestedValue: values?.[0], confidence: 'medium' };
    }

    return { field: fieldName, issueType: issue.issueType, suggestedValue: null, confidence: 'low' };
  }

  getQualityScore(records: Record<string, unknown>[]): number {
    if (records.length === 0) return 100;
    let totalScore = 0;
    for (let i = 0; i < records.length; i++) {
      const result = this.inspectRecord(`temp-${i}`, records[i]!);
      totalScore += result.qualityScore;
    }
    return Math.round(totalScore / records.length);
  }

  // Plan SC: FR-R264.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
