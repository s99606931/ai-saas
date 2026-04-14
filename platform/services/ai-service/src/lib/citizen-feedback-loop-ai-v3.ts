// Design Ref: SVC-AI-ADV-R681.design.md — AI기반 민원인 피드백 루프 v3
// Plan SC: FR-R681.1~5

import { createHash } from 'crypto';

export type FeedbackPriority = 'URGENT' | 'HIGH' | 'NORMAL';
export type FeedbackAction = 'QUEUE' | 'REVIEW' | 'ESCALATE';

interface FeedbackChannel { channelId: string; name: string; weight: number }
interface CitizenFeedback {
  feedbackId: string;
  channelId: string;
  citizenId: string;
  sentimentNegativity: number;
  attachmentImpact: 'high' | 'low';
}
interface FeedbackVerdict {
  feedbackId: string;
  channelId: string;
  maskedCitizenId: string;
  priority: FeedbackPriority;
  action: FeedbackAction;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const ACTION_RANK: FeedbackAction[] = ['QUEUE', 'REVIEW', 'ESCALATE'];

function rankToAction(rank: number): FeedbackAction {
  const idx = Math.max(0, Math.min(ACTION_RANK.length - 1, rank));
  return ACTION_RANK[idx]!;
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class CitizenFeedbackLoopAIV3 {
  private channels = new Map<string, FeedbackChannel>();
  private verdicts: FeedbackVerdict[] = [];
  private auditLog: AuditEntry[] = [];

  registerChannel(ch: FeedbackChannel): void {
    if (ch.weight <= 0 || ch.weight > 2) {
      throw new Error('INVALID_WEIGHT');
    }
    this.channels.set(ch.channelId, ch);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_CHANNEL',
      details: { channelId: ch.channelId, name: ch.name, weight: ch.weight },
    });
  }

  submitFeedback(feedback: CitizenFeedback, dataGrade?: string): FeedbackVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const ch = this.channels.get(feedback.channelId);
    if (!ch) {
      throw new Error(`UNKNOWN_CHANNEL: ${feedback.channelId}`);
    }
    if (feedback.sentimentNegativity < 0 || feedback.sentimentNegativity > 1) {
      throw new Error('INVALID_SENTIMENT');
    }

    const score = feedback.sentimentNegativity * ch.weight;
    let priority: FeedbackPriority;
    let baseRank: number;
    if (score >= 0.8) {
      priority = 'URGENT';
      baseRank = 2;
    } else if (score >= 0.5) {
      priority = 'HIGH';
      baseRank = 1;
    } else {
      priority = 'NORMAL';
      baseRank = 0;
    }

    const finalRank = feedback.attachmentImpact === 'high' ? baseRank + 1 : baseRank;
    const action = rankToAction(finalRank);

    const maskedCitizenId = maskPII(feedback.citizenId);
    const verdict: FeedbackVerdict = {
      feedbackId: feedback.feedbackId,
      channelId: feedback.channelId,
      maskedCitizenId,
      priority,
      action,
    };
    this.verdicts.push(verdict);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SUBMIT_FEEDBACK',
      details: {
        feedbackId: feedback.feedbackId,
        channelId: feedback.channelId,
        maskedCitizenId,
        priority,
        action,
      },
    });
    return verdict;
  }

  getEscalations(): FeedbackVerdict[] {
    return this.verdicts.filter((v) => v.action === 'ESCALATE');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
