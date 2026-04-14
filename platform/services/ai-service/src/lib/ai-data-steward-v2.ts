// Design Ref: SVC-AI-ADV-R691.design.md — AI기반 데이터 스튜어드 자동화 v2
// Plan SC: FR-R691.1~5

import { createHash } from 'crypto';

export type StewardshipStatus = 'HEALTHY' | 'REVIEW' | 'ACTION_REQUIRED';

interface DatasetRecord {
  datasetId: string;
  owner: string;
  qualityScore: number;
  pendingIssues: number;
}
interface IssueReport {
  datasetId: string;
  stewardId: string;
  description: string;
}
interface StewardshipVerdict {
  datasetId: string;
  score: number;
  status: StewardshipStatus;
  maskedStewardId: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class AIDataStewardV2 {
  private datasets = new Map<string, DatasetRecord>();
  private auditLog: AuditEntry[] = [];

  registerDataset(ds: { datasetId: string; owner: string; qualityScore: number }): void {
    if (ds.qualityScore < 0 || ds.qualityScore > 100) {
      throw new Error('INVALID_QUALITY');
    }
    this.datasets.set(ds.datasetId, { ...ds, pendingIssues: 0 });
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_DATASET',
      details: { datasetId: ds.datasetId, owner: ds.owner },
    });
  }

  reportIssue(issue: IssueReport, dataGrade?: string): StewardshipVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const record = this.datasets.get(issue.datasetId);
    if (!record) {
      throw new Error(`UNKNOWN_DATASET: ${issue.datasetId}`);
    }
    record.pendingIssues += 1;

    const score = record.qualityScore - record.pendingIssues * 5;
    let status: StewardshipStatus;
    if (score < 50) status = 'ACTION_REQUIRED';
    else if (score < 80) status = 'REVIEW';
    else status = 'HEALTHY';

    const maskedStewardId = maskPII(issue.stewardId);
    const verdict: StewardshipVerdict = {
      datasetId: issue.datasetId,
      score,
      status,
      maskedStewardId,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REPORT_ISSUE',
      details: {
        datasetId: issue.datasetId,
        score,
        status,
        maskedStewardId,
      },
    });
    return verdict;
  }

  getAtRisk(): string[] {
    const result: string[] = [];
    for (const ds of this.datasets.values()) {
      const score = ds.qualityScore - ds.pendingIssues * 5;
      if (score < 50) result.push(ds.datasetId);
    }
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
