// Design Ref: MTU-N478 §회의 일정 최적화
// Plan SC: FR-MO.1~5

export interface Attendee {
  id: string;
  name: string;
  availability: Array<{ start: string; end: string }>;
  priority: number;
}

export interface MeetingRequest {
  id: string;
  title: string;
  durationMinutes: number;
  attendees: Attendee[];
  preferredWindow?: { start: string; end: string };
}

export interface TimeSlotRecommendation {
  start: string;
  end: string;
  availableAttendees: number;
  priorityScore: number;
}

export interface Reminder {
  meetingId: string;
  attendeeId: string;
  sendAt: string;
}

export class MeetingOptimizer {
  /** FR-MO.1 가용성 집계 (간단: 공통 윈도우 탐색) */
  findCommonSlots(req: MeetingRequest): Array<{ start: string; end: string }> {
    if (req.attendees.length === 0) return [];
    let intersection = [...(req.attendees[0]?.availability ?? [])];
    for (let i = 1; i < req.attendees.length; i++) {
      intersection = this.intersectSlots(
        intersection,
        req.attendees[i]?.availability ?? [],
      );
    }
    return intersection.filter((s) => this.durationMs(s) >= req.durationMinutes * 60_000);
  }

  /** FR-MO.2 우선순위 가중 */
  private priorityScore(req: MeetingRequest, availableAttendees: Attendee[]): number {
    const totalPrio = req.attendees.reduce((s, a) => s + a.priority, 0);
    const availPrio = availableAttendees.reduce((s, a) => s + a.priority, 0);
    return totalPrio === 0 ? 0 : +(availPrio / totalPrio).toFixed(3);
  }

  /** FR-MO.3 시간대 추천 */
  recommend(req: MeetingRequest): TimeSlotRecommendation[] {
    const slots = this.findCommonSlots(req);
    return slots.slice(0, 5).map((s) => {
      const avail = req.attendees.filter((a) =>
        a.availability.some((av) => av.start <= s.start && av.end >= s.end),
      );
      return {
        start: s.start,
        end: this.addMinutes(s.start, req.durationMinutes),
        availableAttendees: avail.length,
        priorityScore: this.priorityScore(req, avail),
      };
    });
  }

  /** FR-MO.4 충돌 해결 (가장 높은 우선순위 슬롯 선택) */
  resolveConflicts(recommendations: TimeSlotRecommendation[]): TimeSlotRecommendation | undefined {
    return [...recommendations].sort((a, b) => b.priorityScore - a.priorityScore)[0];
  }

  /** FR-MO.5 리마인더 */
  scheduleReminders(meetingId: string, attendees: Attendee[], meetingStart: string, leadMinutes = 15): Reminder[] {
    const sendAt = this.addMinutes(meetingStart, -leadMinutes);
    return attendees.map((a) => ({ meetingId, attendeeId: a.id, sendAt }));
  }

  private intersectSlots(a: Array<{ start: string; end: string }>, b: Array<{ start: string; end: string }>): Array<{ start: string; end: string }> {
    const out: Array<{ start: string; end: string }> = [];
    for (const x of a) {
      for (const y of b) {
        const start = x.start > y.start ? x.start : y.start;
        const end = x.end < y.end ? x.end : y.end;
        if (start < end) out.push({ start, end });
      }
    }
    return out;
  }

  private durationMs(slot: { start: string; end: string }): number {
    return new Date(slot.end).getTime() - new Date(slot.start).getTime();
  }

  private addMinutes(iso: string, minutes: number): string {
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString();
  }
}

export const meetingOptimizer = new MeetingOptimizer();
