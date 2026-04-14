// Design Ref: SVC-AI-ADV-R686.design.md — AI기반 규제 샌드박스 관리 v2
// Plan SC: FR-R686.1~5

import { createHash } from 'crypto';

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type SandboxVerdict = 'APPROVE' | 'CONDITIONAL' | 'REJECT';

export interface SandboxApplication {
  applicationId: string;
  sponsorEmail: string;
  consumerImpact: number;
  legalRisk: number;
  dataSensitivity: number;
}

export interface SandboxResult {
  applicationId: string;
  maskedSponsor: string;
  riskScore: number;
  riskLevel: RiskLevel;
  verdict: SandboxVerdict;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details?: Record<string, unknown>;
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

function validateUnit(value: number, name: string): void {
  if (value < 0 || value > 1) {
    throw new Error(`INVALID_${name}`);
  }
}

export class RegulatorySandboxAIV2 {
  private readonly auditLog: AuditEntry[] = [];

  submitApplication(app: SandboxApplication, dataGrade?: string): SandboxResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    validateUnit(app.consumerImpact, 'CONSUMER_IMPACT');
    validateUnit(app.legalRisk, 'LEGAL_RISK');
    validateUnit(app.dataSensitivity, 'DATA_SENSITIVITY');

    const riskScore = Number(
      (app.consumerImpact * 0.4 + app.legalRisk * 0.4 + app.dataSensitivity * 0.2).toFixed(4),
    );

    let riskLevel: RiskLevel;
    let verdict: SandboxVerdict;
    if (riskScore >= 0.7) {
      riskLevel = 'HIGH';
      verdict = 'REJECT';
    } else if (riskScore >= 0.4) {
      riskLevel = 'MEDIUM';
      verdict = 'CONDITIONAL';
    } else {
      riskLevel = 'LOW';
      verdict = 'APPROVE';
    }

    const maskedSponsor = maskPII(app.sponsorEmail);
    const result: SandboxResult = {
      applicationId: app.applicationId,
      maskedSponsor,
      riskScore,
      riskLevel,
      verdict,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SUBMIT_APPLICATION',
      details: { applicationId: app.applicationId, maskedSponsor, riskLevel, verdict },
    });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
