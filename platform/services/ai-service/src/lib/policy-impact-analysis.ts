// 정책 영향 분석 AI -- FR-N284.1~FR-N284.6
// Design Ref: MTU-N284 | CSAP: D-06, D-08, D-12 | N2SF: O등급만 허용

export type DataGrade = 'O' | 'C' | 'S';

export interface PolicyChange {
  readonly policyId: string;
  readonly title: string;
  readonly oldText: string;
  readonly newText: string;
  readonly effectiveDate: string;
  readonly dataGrade: DataGrade;
}

export interface Stakeholder {
  readonly id: string;
  readonly name: string;
  readonly category: 'citizen' | 'business' | 'agency' | 'ngo';
  readonly affectedAreas: readonly string[];
}

export interface ImpactScore {
  readonly stakeholderId: string;
  readonly score: number; // 0~1
  readonly severity: 'low' | 'medium' | 'high';
  readonly reasoning: string;
}

export interface PolicyDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly modified: readonly { old: string; new: string }[];
}

export interface PolicyImpactReport {
  readonly reportId: string;
  readonly policyId: string;
  readonly diff: PolicyDiff;
  readonly impacts: readonly ImpactScore[];
  readonly summary: string;
  readonly generatedAt: string;
}

export interface PolicyAuditEntry {
  readonly timestamp: string;
  readonly tenantId: string;
  readonly actor: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: PolicyAuditEntry[] = [];

function recordAudit(entry: Omit<PolicyAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getPolicyImpactAuditLog(tenantId: string): readonly PolicyAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

function ensureOpenGrade(grade: DataGrade): void {
  if (grade !== 'O') {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

const PII_PATTERNS: ReadonlyArray<{ regex: RegExp; replacement: string }> = [
  { regex: /\d{6}-\d{7}/g, replacement: '[주민번호-마스킹]' },
  { regex: /01\d-\d{3,4}-\d{4}/g, replacement: '[전화-마스킹]' },
  { regex: /[\w.-]+@[\w.-]+\.\w+/g, replacement: '[이메일-마스킹]' },
];

export function maskPii(text: string): string {
  return PII_PATTERNS.reduce((acc, { regex, replacement }) => acc.replace(regex, replacement), text);
}

// FR-N284.1: 법령 변경 비교
export function comparePolicyTexts(oldText: string, newText: string): PolicyDiff {
  const oldLines = oldText.split('\n').map((l) => l.trim()).filter(Boolean);
  const newLines = newText.split('\n').map((l) => l.trim()).filter(Boolean);
  const added = newLines.filter((l) => !oldLines.includes(l));
  const removed = oldLines.filter((l) => !newLines.includes(l));
  const modified: { old: string; new: string }[] = [];
  const minLen = Math.min(oldLines.length, newLines.length);
  for (let i = 0; i < minLen; i++) {
    if (oldLines[i] !== newLines[i] && oldLines[i].length > 0 && newLines[i].length > 0) {
      modified.push({ old: oldLines[i], new: newLines[i] });
    }
  }
  return { added, removed, modified };
}

// FR-N284.2: 영향 범위 분석 + FR-N284.3: 이해관계자 매핑
export function analyzeImpacts(
  diff: PolicyDiff,
  stakeholders: readonly Stakeholder[],
): ImpactScore[] {
  const changeSize = diff.added.length + diff.removed.length + diff.modified.length;
  return stakeholders.map((s) => {
    const matchedAreas = s.affectedAreas.filter((a) =>
      [...diff.added, ...diff.removed, ...diff.modified.map((m) => m.new)].some((c) =>
        c.includes(a),
      ),
    ).length;
    const score = Math.min(1, (matchedAreas / Math.max(s.affectedAreas.length, 1)) * 0.7 + (changeSize > 5 ? 0.3 : 0.1));
    const severity: 'low' | 'medium' | 'high' = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
    return {
      stakeholderId: s.id,
      score,
      severity,
      reasoning: `${matchedAreas}개 영향 영역 매칭, 변경 규모 ${changeSize}건`,
    };
  });
}

// FR-N284.4: 정책 영향 리포트 생성
export function generatePolicyImpactReport(
  tenantId: string,
  actor: string,
  change: PolicyChange,
  stakeholders: readonly Stakeholder[],
): PolicyImpactReport {
  ensureOpenGrade(change.dataGrade);
  const safeOld = maskPii(change.oldText);
  const safeNew = maskPii(change.newText);
  const diff = comparePolicyTexts(safeOld, safeNew);
  const impacts = analyzeImpacts(diff, stakeholders);
  const high = impacts.filter((i) => i.severity === 'high').length;
  const summary = `${change.title}: 변경 ${diff.added.length}추가/${diff.removed.length}삭제/${diff.modified.length}수정, 고영향 이해관계자 ${high}명`;
  const report: PolicyImpactReport = {
    reportId: `pir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    policyId: change.policyId,
    diff,
    impacts,
    summary,
    generatedAt: new Date().toISOString(),
  };
  recordAudit({
    tenantId,
    actor,
    action: 'POLICY_IMPACT_REPORT',
    target: report.reportId,
    details: { policyId: change.policyId, highImpact: high, totalChanges: diff.added.length + diff.removed.length + diff.modified.length },
  });
  return report;
}

// FR-N284.5: 변경 추적
export interface PolicyHistory {
  readonly versionId: string;
  readonly policyId: string;
  readonly summary: string;
  readonly date: string;
}

const historyStore: PolicyHistory[] = [];

export function addPolicyHistory(h: PolicyHistory): void {
  historyStore.push(h);
}

export function getPolicyHistory(policyId: string): readonly PolicyHistory[] {
  return historyStore.filter((h) => h.policyId === policyId);
}

// FR-N284.6 + Service Wrapper
export class PolicyImpactAnalysisService {
  constructor(private readonly tenantId: string) {}

  analyze(change: PolicyChange, stakeholders: readonly Stakeholder[], actor: string = 'system'): PolicyImpactReport {
    return generatePolicyImpactReport(this.tenantId, actor, change, stakeholders);
  }

  history(policyId: string): readonly PolicyHistory[] {
    return getPolicyHistory(policyId);
  }

  audit(): readonly PolicyAuditEntry[] {
    return getPolicyImpactAuditLog(this.tenantId);
  }
}
