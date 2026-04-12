// SVC-AI-ADV-R359 Smart Notification Router v2
// Design Ref: SVC-AI-ADV-R359.design.md
// Plan SC: SC-R359-1~4
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Channel = 'email' | 'sms' | 'push' | 'inapp';
export type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export interface UserPrefs {
  readonly userId: string;
  readonly preferred: readonly Channel[];
  readonly quietStart: number;
  readonly quietEnd: number;
}

export interface NotificationRequest {
  readonly userId: string;
  readonly priority: Priority;
  readonly grade: DataGrade;
  readonly hour: number;
}

export interface RouteDecision {
  readonly userId: string;
  readonly selected: Channel;
  readonly fallbacks: readonly Channel[];
  readonly quietOverride: boolean;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class SmartNotificationRouterV2 {
  private readonly auditLog: AuditEntry[] = [];

  route(req: NotificationRequest, prefs: UserPrefs): RouteDecision {
    if (req.grade === 'C' || req.grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${req.grade}등급 알림 차단 (N2SF N-05)`);
    }
    if (prefs.preferred.length === 0) {
      throw new Error('INVALID_PARAMS: no preferred channels');
    }

    const inQuiet = this.isQuiet(req.hour, prefs.quietStart, prefs.quietEnd);
    const quietOverride = req.priority === 'CRITICAL' && inQuiet;

    let selected: Channel;
    let fallbacks: readonly Channel[];

    if (!inQuiet || quietOverride) {
      const first = prefs.preferred[0];
      if (!first) throw new Error('INVALID_PARAMS: empty preferred');
      selected = first;
      fallbacks = prefs.preferred.slice(1);
    } else {
      // 조용 시간 + non-critical → inapp 우선
      const nonIntrusive: Channel = 'inapp';
      selected = nonIntrusive;
      fallbacks = prefs.preferred.filter((c) => c !== nonIntrusive);
    }

    const decision: RouteDecision = {
      userId: req.userId,
      selected,
      fallbacks,
      quietOverride,
    };

    this.record('ROUTE', req.userId, {
      priority: req.priority,
      selected,
      quietOverride,
    });

    return decision;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private isQuiet(hour: number, start: number, end: number): boolean {
    if (start === end) return false;
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end;
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
