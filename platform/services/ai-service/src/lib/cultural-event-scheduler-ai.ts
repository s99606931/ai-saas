// Design Ref: §문화 행사 일정 AI
// Plan SC: FR-R625.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type EventCategory = 'concert' | 'exhibition' | 'festival' | 'lecture' | 'workshop';

interface Venue {
  venueId: string;
  capacity: number;
  indoor: boolean;
}

interface CulturalEvent {
  eventId: string;
  category: EventCategory;
  expectedAudience: number;
  durationHours: number;
  preferredStart: string; // ISO
}

interface ScheduledEvent {
  eventId: string;
  venueId: string;
  startAt: string;
  endAt: string;
  utilization: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class CulturalEventSchedulerAI {
  private venues = new Map<string, Venue>();
  private schedule: ScheduledEvent[] = [];
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R625.1
  registerVenue(v: Venue, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (v.capacity <= 0) throw new Error('capacity > 0 필요');
    this.venues.set(v.venueId, v);
    this.log('REGISTER_VENUE', { venueId: v.venueId });
  }

  // Plan SC: FR-R625.2
  private isConflict(venueId: string, start: Date, end: Date): boolean {
    return this.schedule.some((s) => {
      if (s.venueId !== venueId) return false;
      const sStart = new Date(s.startAt);
      const sEnd = new Date(s.endAt);
      return start < sEnd && end > sStart;
    });
  }

  // Plan SC: FR-R625.3
  private pickVenue(event: CulturalEvent): Venue | undefined {
    const candidates = Array.from(this.venues.values())
      .filter((v) => v.capacity >= event.expectedAudience)
      .sort((a, b) => a.capacity - b.capacity); // 용량 최소 우선 (낭비 최소화)
    return candidates[0];
  }

  // Plan SC: FR-R625.4
  schedule_(event: CulturalEvent, grade: DataGrade = DataGrade.O): ScheduledEvent {
    blockClassifiedData(grade);
    if (event.expectedAudience <= 0 || event.durationHours <= 0) {
      throw new Error('관객 수/시간은 양수');
    }
    const venue = this.pickVenue(event);
    if (!venue) throw new Error(`적합 venue 없음: 최소 ${event.expectedAudience}명 수용 필요`);

    let start = new Date(event.preferredStart);
    let end = new Date(start.getTime() + event.durationHours * 3600 * 1000);
    // 충돌 시 2시간씩 뒤로 이동 (최대 48시간)
    let shifted = 0;
    while (this.isConflict(venue.venueId, start, end) && shifted < 24) {
      start = new Date(start.getTime() + 2 * 3600 * 1000);
      end = new Date(start.getTime() + event.durationHours * 3600 * 1000);
      shifted++;
    }
    if (this.isConflict(venue.venueId, start, end)) {
      throw new Error('48시간 내 가용 슬롯 없음');
    }

    const utilization = +(event.expectedAudience / venue.capacity).toFixed(3);
    const scheduled: ScheduledEvent = {
      eventId: event.eventId,
      venueId: venue.venueId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      utilization,
    };
    this.schedule.push(scheduled);
    this.log('SCHEDULE', { eventId: event.eventId, venueId: venue.venueId, utilization });
    return scheduled;
  }

  // Plan SC: FR-R625.5
  listScheduled(): readonly ScheduledEvent[] {
    return this.schedule;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
