// 에이전트 감사 추적 — FR-N393.1~5
// CSAP: D-06 감사 로깅, append-only

import { createHash } from 'node:crypto';

export type AgentActionType =
  | 'execute'
  | 'read'
  | 'write'
  | 'tool_call'
  | 'external_api'
  | 'error';

export interface AgentAuditEntry {
  seq: number;
  timestamp: string;
  agentId: string;
  actorId: string;
  action: AgentActionType;
  resource: string;
  details: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface AuditQuery {
  agentId?: string;
  actorId?: string;
  action?: AgentActionType;
  since?: string;
  until?: string;
}

export class AgentAuditTrail {
  private readonly entries: AgentAuditEntry[] = [];
  private readonly retentionDays: number;

  constructor(retentionDays = 365) {
    if (retentionDays <= 0) throw new Error('AUDIT_INVALID_RETENTION');
    this.retentionDays = retentionDays;
  }

  append(input: Omit<AgentAuditEntry, 'seq' | 'timestamp' | 'prevHash' | 'hash'>): AgentAuditEntry {
    const last = this.entries[this.entries.length - 1];
    const prevHash = last?.hash ?? 'GENESIS';
    const seq = this.entries.length;
    const timestamp = new Date().toISOString();
    const base = {
      seq,
      timestamp,
      agentId: input.agentId,
      actorId: input.actorId,
      action: input.action,
      resource: input.resource,
      details: input.details,
      prevHash,
    };
    const hash = this.computeHash(base);
    const entry: AgentAuditEntry = { ...base, hash };
    this.entries.push(entry);
    return entry;
  }

  query(q: AuditQuery): AgentAuditEntry[] {
    return this.entries.filter((e) => {
      if (q.agentId && e.agentId !== q.agentId) return false;
      if (q.actorId && e.actorId !== q.actorId) return false;
      if (q.action && e.action !== q.action) return false;
      if (q.since && e.timestamp < q.since) return false;
      if (q.until && e.timestamp > q.until) return false;
      return true;
    });
  }

  verifyIntegrity(): { valid: boolean; brokenAtSeq?: number } {
    let prevHash = 'GENESIS';
    for (const entry of this.entries) {
      if (entry.prevHash !== prevHash) {
        return { valid: false, brokenAtSeq: entry.seq };
      }
      const computed = this.computeHash({
        seq: entry.seq,
        timestamp: entry.timestamp,
        agentId: entry.agentId,
        actorId: entry.actorId,
        action: entry.action,
        resource: entry.resource,
        details: entry.details,
        prevHash: entry.prevHash,
      });
      if (computed !== entry.hash) {
        return { valid: false, brokenAtSeq: entry.seq };
      }
      prevHash = entry.hash;
    }
    return { valid: true };
  }

  archiveExpired(now: Date = new Date()): AgentAuditEntry[] {
    const cutoff = new Date(now.getTime() - this.retentionDays * 86400000).toISOString();
    const archived: AgentAuditEntry[] = [];
    while (this.entries.length > 0) {
      const head = this.entries[0];
      if (!head || head.timestamp >= cutoff) break;
      archived.push(head);
      this.entries.shift();
    }
    return archived;
  }

  size(): number {
    return this.entries.length;
  }

  private computeHash(base: Omit<AgentAuditEntry, 'hash'>): string {
    const payload = JSON.stringify(base);
    return createHash('sha256').update(payload).digest('hex');
  }
}
