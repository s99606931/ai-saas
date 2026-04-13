// Design Ref: §핵심 알고리즘 — 필드 완전성 + 응답시간 품질 점수
// Plan SC: FR-R292.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ApiProfile {
  id: string;
  name: string;
  requiredFields: string[];
  targetResponseTimeMs: number;
}

interface EvaluationResult {
  apiId: string;
  qualityScore: number;
  issues: string[];
  passed: boolean;
}

interface QualityIssue {
  apiId: string;
  issue: string;
  qualityScore: number;
  recordedAt: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R292.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class ApiResponseQualityEvaluator {
  private profiles = new Map<string, ApiProfile>();
  private issueLog: QualityIssue[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R292.1
  registerApiProfile(id: string, name: string, requiredFields: string[], targetResponseTimeMs: number): void {
    this.profiles.set(id, { id, name, requiredFields, targetResponseTimeMs });
    this.log('REGISTER_API_PROFILE', { id, name, requiredFieldCount: requiredFields.length, targetResponseTimeMs });
  }

  // Plan SC: FR-R292.2 + R292.3
  evaluateResponse(apiId: string, responseBody: Record<string, unknown>, responseTimeMs: number, grade: DataGrade = DataGrade.O): EvaluationResult {
    guardDataGrade(grade);
    const profile = this.profiles.get(apiId);
    if (!profile) throw new Error(`API 프로파일 미등록: ${apiId}`);

    const issues: string[] = [];
    const presentFields = profile.requiredFields.filter(f => responseBody[f] !== undefined && responseBody[f] !== null);
    const fieldCompleteness = profile.requiredFields.length === 0 ? 1 : presentFields.length / profile.requiredFields.length;
    const missingFields = profile.requiredFields.filter(f => responseBody[f] === undefined || responseBody[f] === null);
    if (missingFields.length > 0) issues.push(`필수 필드 누락: ${missingFields.join(', ')}`);

    const fieldScore = Math.round(fieldCompleteness * 50);
    const rtScore = responseTimeMs <= profile.targetResponseTimeMs
      ? 50
      : Math.round(50 * (profile.targetResponseTimeMs / responseTimeMs));
    if (responseTimeMs > profile.targetResponseTimeMs) issues.push(`응답 지연 (${responseTimeMs}ms > ${profile.targetResponseTimeMs}ms)`);

    const qualityScore = fieldScore + rtScore;
    const passed = qualityScore >= 80 && issues.length === 0;

    if (!passed) {
      for (const issue of issues) {
        this.issueLog.push({ apiId, issue, qualityScore, recordedAt: new Date().toISOString() });
      }
    }

    this.log('EVALUATE_RESPONSE', { apiId, qualityScore, issueCount: issues.length, passed });
    return { apiId, qualityScore, issues, passed };
  }

  // Plan SC: FR-R292.4
  getQualityIssues(apiId?: string): QualityIssue[] {
    if (apiId) return this.issueLog.filter(i => i.apiId === apiId);
    return [...this.issueLog];
  }

  // Plan SC: FR-R292.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
