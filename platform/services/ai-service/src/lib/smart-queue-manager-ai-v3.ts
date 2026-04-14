// Design Ref: SVC-AI-ADV-R685.design.md — AI기반 스마트 큐 관리 v3
// Plan SC: FR-R685.1~5

import { createHash } from 'crypto';

export type QueuePressure = 'HIGH' | 'MEDIUM' | 'LOW';
export type QueueAction = 'HOLD' | 'PRIORITIZE' | 'REBALANCE';

export interface QueueDefinition {
  queueId: string;
  capacity: number;
  slaMs: number;
}

export interface QueueJob {
  jobId: string;
  queueId: string;
  jobOwner: string;
  currentLength: number;
  waitMs: number;
}

export interface QueueVerdict {
  jobId: string;
  queueId: string;
  maskedOwner: string;
  pressure: QueuePressure;
  action: QueueAction;
  ratio: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details?: Record<string, unknown>;
}

const RANK: QueueAction[] = ['HOLD', 'PRIORITIZE', 'REBALANCE'];

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class SmartQueueManagerAIV3 {
  private readonly queues = new Map<string, QueueDefinition>();
  private readonly auditLog: AuditEntry[] = [];

  defineQueue(q: QueueDefinition): void {
    if (q.capacity <= 0 || q.slaMs <= 0) {
      throw new Error('INVALID_QUEUE_CONFIG');
    }
    this.queues.set(q.queueId, q);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'DEFINE_QUEUE',
      details: { queueId: q.queueId, capacity: q.capacity, slaMs: q.slaMs },
    });
  }

  enqueue(job: QueueJob, dataGrade?: string): QueueVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const queue = this.queues.get(job.queueId);
    if (!queue) {
      throw new Error(`UNKNOWN_QUEUE: ${job.queueId}`);
    }
    if (job.currentLength < 0 || job.waitMs < 0) {
      throw new Error('INVALID_JOB_METRIC');
    }

    const ratio = job.currentLength / queue.capacity;
    let pressure: QueuePressure;
    let baseRank: number;
    if (ratio >= 0.8) {
      pressure = 'HIGH';
      baseRank = 2;
    } else if (ratio >= 0.5) {
      pressure = 'MEDIUM';
      baseRank = 1;
    } else {
      pressure = 'LOW';
      baseRank = 0;
    }

    if (job.waitMs > queue.slaMs && baseRank < RANK.length - 1) {
      baseRank += 1;
    }
    const action = RANK[baseRank]!;

    const maskedOwner = maskPII(job.jobOwner);
    const verdict: QueueVerdict = {
      jobId: job.jobId,
      queueId: job.queueId,
      maskedOwner,
      pressure,
      action,
      ratio: Number(ratio.toFixed(4)),
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ENQUEUE',
      details: { jobId: job.jobId, queueId: job.queueId, maskedOwner, pressure, action },
    });
    return verdict;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
