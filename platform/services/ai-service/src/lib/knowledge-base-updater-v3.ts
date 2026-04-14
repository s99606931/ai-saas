// Design Ref: SVC-AI-ADV-R602-v3.design.md §알고리즘
// Plan SC: SC-R602v3-1, SC-R602v3-2, SC-R602v3-3
// 트랙 A 22차

export interface KbEntry {
  id: string;
  title: string;
  grade: 'C' | 'S' | 'O';
  updatedAt: string;
  ttlDays: number;
}

export type KbStatus = 'ACTIVE' | 'EXPIRED';

export interface KbItemResult {
  id: string;
  status: KbStatus;
}

export interface KbUpdateResult {
  active: number;
  expired: number;
  items: KbItemResult[];
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
}

const DAY_MS = 86_400_000;

export class KnowledgeBaseUpdaterV3 {
  private readonly auditLog: AuditEntry[] = [];

  update(entries: KbEntry[], now: Date = new Date()): KbUpdateResult {
    if (entries.some((e) => e.grade === 'C' || e.grade === 'S')) {
      throw new Error('BLOCKED: C/S등급 AI API 전송 금지 (N2SF N-05)');
    }

    const items: KbItemResult[] = entries.map((e) => {
      const ageMs = now.getTime() - new Date(e.updatedAt).getTime();
      const ttlMs = e.ttlDays * DAY_MS;
      const status: KbStatus = ageMs > ttlMs ? 'EXPIRED' : 'ACTIVE';
      return { id: e.id, status };
    });

    const active = items.filter((i) => i.status === 'ACTIVE').length;
    const expired = items.length - active;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'KB_UPDATE',
      details: { total: items.length, active, expired },
    });

    return { active, expired, items };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
