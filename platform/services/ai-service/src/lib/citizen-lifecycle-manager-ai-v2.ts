// Design Ref: SVC-AI-ADV-R688.design.md — AI기반 민원인 생애주기 관리 v2
// Plan SC: FR-R688.1~5

import { createHash } from 'crypto';

export type LifecycleStage = 'NEW' | 'ACTIVE' | 'LOYAL' | 'AT_RISK';
export type LifecycleAction = 'ONBOARD' | 'NURTURE' | 'REWARD' | 'INTERVENE';

export interface ContactEvent {
  citizenId: string;
  contacts: number;
  satisfaction: number;
}

export interface LifecycleVerdict {
  maskedCitizenId: string;
  stage: LifecycleStage;
  action: LifecycleAction;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details?: Record<string, unknown>;
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

const ACTION_BY_STAGE: Record<LifecycleStage, LifecycleAction> = {
  NEW: 'ONBOARD',
  ACTIVE: 'NURTURE',
  LOYAL: 'REWARD',
  AT_RISK: 'INTERVENE',
};

export class CitizenLifecycleManagerAIV2 {
  private readonly stages = new Map<string, LifecycleStage>();
  private readonly auditLog: AuditEntry[] = [];

  updateContact(event: ContactEvent, dataGrade?: string): LifecycleVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (event.contacts < 0) {
      throw new Error('INVALID_CONTACTS');
    }
    if (event.satisfaction < 0 || event.satisfaction > 1) {
      throw new Error('INVALID_SATISFACTION');
    }

    const maskedCitizenId = maskPII(event.citizenId);

    let stage: LifecycleStage;
    if (event.contacts >= 1 && event.satisfaction < 0.4) {
      stage = 'AT_RISK';
    } else if (event.contacts === 0) {
      stage = 'NEW';
    } else if (event.contacts >= 3 && event.satisfaction >= 0.7) {
      stage = 'LOYAL';
    } else {
      stage = 'ACTIVE';
    }

    const action = ACTION_BY_STAGE[stage];
    this.stages.set(maskedCitizenId, stage);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'UPDATE_CONTACT',
      details: { maskedCitizenId, stage, action },
    });
    return { maskedCitizenId, stage, action };
  }

  getStage(maskedCitizenId: string): LifecycleStage | undefined {
    return this.stages.get(maskedCitizenId);
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
