// Design Ref: MTU-N450 §알림 타이밍 개인화 AI
// Plan SC: FR-N450.1~5

export interface NotificationEvent {
  userId: string;
  notificationId: string;
  sentHour: number;
  reacted: boolean;
  reactionDelayMinutes?: number;
  dayOfWeek: number;
}

export interface HourlyReactionRate {
  hour: number;
  sent: number;
  reactions: number;
  rate: number;
}

export interface OptimalWindow {
  userId: string;
  bestHours: number[];
  bestDayOfWeek: number;
  confidence: number;
}

export interface DoNotDisturbWindow {
  userId: string;
  startHour: number;
  endHour: number;
}

export interface ScheduledNotification {
  userId: string;
  notificationId: string;
  scheduledHour: number;
  reason: string;
}

export class NotificationTimingAi {
  /** FR-N450.1 이벤트 수집 */
  ingest(events: NotificationEvent[]): NotificationEvent[] {
    return events.filter((e) => e.userId && e.sentHour >= 0 && e.sentHour < 24);
  }

  /** FR-N450.2 시간대별 반응률 */
  analyzeHourlyRates(events: NotificationEvent[]): HourlyReactionRate[] {
    const buckets = new Map<number, { sent: number; reactions: number }>();
    for (let h = 0; h < 24; h++) buckets.set(h, { sent: 0, reactions: 0 });
    for (const e of events) {
      const b = buckets.get(e.sentHour);
      if (!b) continue;
      b.sent++;
      if (e.reacted) b.reactions++;
    }
    const list: HourlyReactionRate[] = [];
    for (const [hour, b] of buckets) {
      list.push({
        hour,
        sent: b.sent,
        reactions: b.reactions,
        rate: b.sent === 0 ? 0 : +(b.reactions / b.sent).toFixed(3),
      });
    }
    return list.sort((a, b) => a.hour - b.hour);
  }

  /** FR-N450.3 최적 시간대 계산 */
  findOptimalWindow(userId: string, events: NotificationEvent[]): OptimalWindow {
    const userEvents = events.filter((e) => e.userId === userId);
    const rates = this.analyzeHourlyRates(userEvents);
    const sorted = [...rates].filter((r) => r.sent >= 2).sort((a, b) => b.rate - a.rate);
    const top3 = sorted.slice(0, 3).map((r) => r.hour);

    const dowCounts = new Map<number, number>();
    for (const e of userEvents) {
      if (e.reacted) dowCounts.set(e.dayOfWeek, (dowCounts.get(e.dayOfWeek) ?? 0) + 1);
    }
    let bestDay = 1;
    let bestCount = -1;
    for (const [day, count] of dowCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestDay = day;
      }
    }

    return {
      userId,
      bestHours: top3,
      bestDayOfWeek: bestDay,
      confidence: Math.min(1, userEvents.length / 50),
    };
  }

  /** FR-N450.4 방해금지 구간 탐지 (반응률 0인 연속 시간) */
  detectDoNotDisturb(userId: string, events: NotificationEvent[]): DoNotDisturbWindow {
    const rates = this.analyzeHourlyRates(events.filter((e) => e.userId === userId));
    // 연속 0% 구간 찾기
    let bestStart = 22;
    let bestEnd = 7;
    let maxLen = 0;
    let curStart = -1;
    for (let h = 0; h < 24; h++) {
      const r = rates[h];
      if (r && r.sent >= 2 && r.rate === 0) {
        if (curStart === -1) curStart = h;
        const len = h - curStart + 1;
        if (len > maxLen) {
          maxLen = len;
          bestStart = curStart;
          bestEnd = h;
        }
      } else {
        curStart = -1;
      }
    }
    return { userId, startHour: bestStart, endHour: bestEnd };
  }

  /** FR-N450.5 알림 예약 큐 */
  scheduleNotifications(
    notificationIds: string[],
    window: OptimalWindow,
    dnd: DoNotDisturbWindow,
  ): ScheduledNotification[] {
    const schedule: ScheduledNotification[] = [];
    for (const id of notificationIds) {
      const candidate = window.bestHours.find((h) => !this.isDndHour(h, dnd));
      const hour = candidate ?? 10;
      schedule.push({
        userId: window.userId,
        notificationId: id,
        scheduledHour: hour,
        reason: candidate !== undefined ? '최적 시간대' : '기본 시간대 (방해금지 회피)',
      });
    }
    return schedule;
  }

  private isDndHour(hour: number, dnd: DoNotDisturbWindow): boolean {
    if (dnd.startHour <= dnd.endHour) {
      return hour >= dnd.startHour && hour <= dnd.endHour;
    }
    return hour >= dnd.startHour || hour <= dnd.endHour;
  }
}

export const notificationTimingAi = new NotificationTimingAi();
