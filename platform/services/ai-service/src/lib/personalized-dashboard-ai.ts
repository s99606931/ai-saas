// Design Ref: MTU-N446 §개인화 대시보드 AI
// Plan SC: FR-N446.1~5

export interface UserBehaviorEvent {
  userId: string;
  widgetId: string;
  action: 'view' | 'click' | 'close' | 'dwell';
  durationMs?: number;
  timestamp: number;
}

export interface WidgetUsage {
  widgetId: string;
  clickCount: number;
  viewCount: number;
  totalDwellMs: number;
}

export interface LayoutWidget {
  widgetId: string;
  order: number;
  visible: boolean;
}

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface LayoutProposal {
  userId: string;
  role: UserRole;
  widgets: LayoutWidget[];
}

export interface ExperimentVariant {
  variantId: string;
  userIds: string[];
  widgets: LayoutWidget[];
}

export class PersonalizedDashboardAi {
  /** FR-N446.1 이벤트 수집 */
  ingest(events: UserBehaviorEvent[]): UserBehaviorEvent[] {
    return events.filter((e) => e.userId && e.widgetId);
  }

  /** FR-N446.2 위젯 사용량 집계 */
  aggregateUsage(events: UserBehaviorEvent[]): Map<string, WidgetUsage> {
    const map = new Map<string, WidgetUsage>();
    for (const e of events) {
      const u = map.get(e.widgetId) ?? {
        widgetId: e.widgetId,
        clickCount: 0,
        viewCount: 0,
        totalDwellMs: 0,
      };
      if (e.action === 'click') u.clickCount++;
      if (e.action === 'view') u.viewCount++;
      if (e.action === 'dwell') u.totalDwellMs += e.durationMs ?? 0;
      map.set(e.widgetId, u);
    }
    return map;
  }

  /** FR-N446.3 역할별 기본 레이아웃 */
  defaultLayout(role: UserRole): LayoutWidget[] {
    switch (role) {
      case 'admin':
        return [
          { widgetId: 'system-health', order: 1, visible: true },
          { widgetId: 'user-mgmt', order: 2, visible: true },
          { widgetId: 'audit-log', order: 3, visible: true },
        ];
      case 'operator':
        return [
          { widgetId: 'task-queue', order: 1, visible: true },
          { widgetId: 'alerts', order: 2, visible: true },
        ];
      case 'viewer':
        return [{ widgetId: 'summary', order: 1, visible: true }];
    }
  }

  /** FR-N446.4 개인화 점수 기반 순서 최적화 */
  optimizeLayout(userId: string, role: UserRole, usage: Map<string, WidgetUsage>): LayoutProposal {
    const base = this.defaultLayout(role);
    const scored = base.map((w) => {
      const u = usage.get(w.widgetId);
      const score = u ? u.clickCount * 2 + u.viewCount + u.totalDwellMs / 10000 : 0;
      return { w, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return {
      userId,
      role,
      widgets: scored.map((s, idx) => ({ ...s.w, order: idx + 1 })),
    };
  }

  /** FR-N446.5 A/B 실험 할당 */
  assignVariant(userId: string, variants: ExperimentVariant[]): string {
    if (variants.length === 0) return 'default';
    const hash = [...userId].reduce<number>((acc, ch) => acc + ch.charCodeAt(0), 0);
    const idx = hash % variants.length;
    const variant = variants[idx];
    return variant?.variantId ?? 'default';
  }
}

export const personalizedDashboardAi = new PersonalizedDashboardAi();
