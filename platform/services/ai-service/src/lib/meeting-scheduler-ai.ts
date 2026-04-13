// SVC-AI-ADV-R395 AI-Driven Meeting Scheduler
// Design Ref: SVC-AI-ADV-R395.design.md
// Plan SC: SC-R395-1~4
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Attendee {
  readonly id: string;
  readonly availableSlots: readonly number[];
  readonly preferredSlots: readonly number[];
}

export interface Room {
  readonly capacity: number;
}

export interface SlotScore {
  readonly slot: number;
  readonly score: number;
  readonly availability: number;
  readonly preference: number;
  readonly roomFit: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class MeetingSchedulerAI {
  private readonly auditLog: AuditEntry[] = [];

  recommend(
    attendees: readonly Attendee[],
    room: Room,
    candidateSlots: readonly number[],
    grade: DataGrade = 'O',
  ): readonly SlotScore[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 회의 데이터 차단 (N2SF N-05)`);
    }
    if (attendees.length === 0 || candidateSlots.length === 0) {
      return [];
    }

    const roomFit = attendees.length <= room.capacity ? 1 : 0;

    const scored: SlotScore[] = candidateSlots.map((slot) => {
      const avail =
        attendees.filter((a) => a.availableSlots.includes(slot)).length / attendees.length;
      const pref =
        attendees.filter((a) => a.preferredSlots.includes(slot)).length / attendees.length;
      const score = Number((avail * 0.5 + pref * 0.3 + roomFit * 0.2).toFixed(4));
      return {
        slot,
        score,
        availability: Number(avail.toFixed(4)),
        preference: Number(pref.toFixed(4)),
        roomFit,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3);
    this.record('RECOMMEND', 'meeting', { count: top3.length });
    return top3;
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
