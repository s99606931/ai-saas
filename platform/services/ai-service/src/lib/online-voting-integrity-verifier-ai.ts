// SVC-AI-ADV-R433 Online Voting Integrity Verifier AI
// Design Ref: SVC-AI-ADV-R433.design.md
// Plan SC: FR-433.1~5
// CSAP D-06/D-12 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface VoteEvent {
  readonly voteId: string;
  readonly voterId: string;
  readonly ip: string;
  readonly timestamp: string;
}

export interface SuspiciousVote {
  readonly voteId: string;
  readonly reasons: readonly string[];
}

export interface IntegrityReport {
  readonly suspicious: readonly SuspiciousVote[];
  readonly totalScanned: number;
  readonly flaggedCount: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class OnlineVotingIntegrityVerifierAI {
  private readonly auditLog: AuditEntry[] = [];

  verify(events: readonly VoteEvent[], grade: DataGrade = 'O'): IntegrityReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 투표 데이터 차단 (N2SF N-05)`);
    }

    const reasonsByVote = new Map<string, Set<string>>();
    const addReason = (voteId: string, reason: string): void => {
      if (!reasonsByVote.has(voteId)) reasonsByVote.set(voteId, new Set());
      reasonsByVote.get(voteId)!.add(reason);
    };

    // FR-433.1: 중복 voterId
    const byVoter = new Map<string, VoteEvent[]>();
    for (const e of events) {
      if (!byVoter.has(e.voterId)) byVoter.set(e.voterId, []);
      byVoter.get(e.voterId)!.push(e);
    }
    for (const [, list] of byVoter) {
      if (list.length > 1) list.forEach((e) => addReason(e.voteId, 'DUPLICATE'));
    }

    // FR-433.2: 동일 IP > 5
    const byIp = new Map<string, VoteEvent[]>();
    for (const e of events) {
      if (!byIp.has(e.ip)) byIp.set(e.ip, []);
      byIp.get(e.ip)!.push(e);
    }
    for (const [, list] of byIp) {
      if (list.length > 5) list.forEach((e) => addReason(e.voteId, 'SUSPICIOUS_IP'));
    }

    // FR-433.3: 봇 속도 (동일 voter 기준)
    for (const [, list] of byVoter) {
      const sorted = [...list].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      for (let i = 1; i < sorted.length; i++) {
        const gap =
          new Date(sorted[i]!.timestamp).getTime() - new Date(sorted[i - 1]!.timestamp).getTime();
        if (gap < 2000) addReason(sorted[i]!.voteId, 'BOT_SPEED');
      }
    }

    const suspicious: SuspiciousVote[] = [];
    for (const [voteId, reasons] of reasonsByVote) {
      suspicious.push({ voteId, reasons: [...reasons].sort() });
    }

    this.record('VERIFY', 'ballot', {
      total: events.length,
      flagged: suspicious.length,
    });
    return {
      suspicious,
      totalScanned: events.length,
      flaggedCount: suspicious.length,
    };
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
