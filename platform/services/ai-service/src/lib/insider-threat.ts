// Design Ref: MTU-N482 §내부자 위협 AI
// Plan SC: FR-IT.1~5

export interface UserActivity {
  userId: string;
  action: string;
  resource: string;
  bytesTransferred?: number;
  timestamp: string;
  hour: number;
}

export interface UserBaseline {
  userId: string;
  avgActionsPerDay: number;
  commonHours: number[];
  commonResources: Set<string>;
}

export interface UebaScore {
  userId: string;
  score: number;
  reasons: string[];
}

export interface ExfilPattern {
  userId: string;
  totalBytes: number;
  timeWindowMinutes: number;
  suspicious: boolean;
}

export interface Alert {
  userId: string;
  severity: 'info' | 'warning' | 'critical';
  route: 'soc' | 'manager' | 'compliance';
}

export class InsiderThreat {
  private baselines = new Map<string, UserBaseline>();

  /** FR-IT.1 행동 베이스라인 */
  learnBaseline(activities: UserActivity[]): UserBaseline[] {
    const byUser = new Map<string, UserActivity[]>();
    for (const a of activities) {
      if (!byUser.has(a.userId)) byUser.set(a.userId, []);
      byUser.get(a.userId)!.push(a);
    }
    const out: UserBaseline[] = [];
    for (const [userId, acts] of byUser) {
      const avgActionsPerDay = acts.length;
      const hourCounts = new Map<number, number>();
      acts.forEach((a) => hourCounts.set(a.hour, (hourCounts.get(a.hour) ?? 0) + 1));
      const commonHours = Array.from(hourCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([h]) => h);
      const commonResources = new Set(acts.map((a) => a.resource));
      const baseline = { userId, avgActionsPerDay, commonHours, commonResources };
      this.baselines.set(userId, baseline);
      out.push(baseline);
    }
    return out;
  }

  /** FR-IT.2 UEBA 이상 점수 */
  scoreUeba(userId: string, recent: UserActivity[]): UebaScore {
    const b = this.baselines.get(userId);
    if (!b) return { userId, score: 0, reasons: ['베이스라인 없음'] };
    let score = 0;
    const reasons: string[] = [];
    if (recent.length > b.avgActionsPerDay * 2) {
      score += 30;
      reasons.push('활동량 2배 초과');
    }
    const offHour = recent.filter((a) => !b.commonHours.includes(a.hour)).length;
    if (offHour > recent.length * 0.5) {
      score += 20;
      reasons.push('비정상 시간대 다수');
    }
    const newRes = recent.filter((a) => !b.commonResources.has(a.resource)).length;
    if (newRes > 5) {
      score += 15;
      reasons.push('신규 리소스 접근');
    }
    return { userId, score, reasons };
  }

  /** FR-IT.3 권한 남용 탐지 */
  detectPrivilegeAbuse(activities: UserActivity[], sensitiveResources: Set<string>): string[] {
    const abusers = new Set<string>();
    for (const a of activities) {
      if (sensitiveResources.has(a.resource) && a.action === 'delete') abusers.add(a.userId);
    }
    return Array.from(abusers);
  }

  /** FR-IT.4 데이터 반출 패턴 */
  detectExfiltration(activities: UserActivity[], thresholdMb = 100): ExfilPattern[] {
    const byUser = new Map<string, number>();
    for (const a of activities) {
      byUser.set(a.userId, (byUser.get(a.userId) ?? 0) + (a.bytesTransferred ?? 0));
    }
    const out: ExfilPattern[] = [];
    for (const [userId, total] of byUser) {
      out.push({
        userId,
        totalBytes: total,
        timeWindowMinutes: 60,
        suspicious: total > thresholdMb * 1024 * 1024,
      });
    }
    return out;
  }

  /** FR-IT.5 경보 라우팅 */
  route(score: UebaScore): Alert {
    let severity: Alert['severity'] = 'info';
    let route: Alert['route'] = 'soc';
    if (score.score >= 50) {
      severity = 'critical';
      route = 'compliance';
    } else if (score.score >= 25) {
      severity = 'warning';
      route = 'manager';
    }
    return { userId: score.userId, severity, route };
  }
}

export const insiderThreat = new InsiderThreat();
