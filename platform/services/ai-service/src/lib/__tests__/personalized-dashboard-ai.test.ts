import { describe, it, expect } from 'vitest';
import { PersonalizedDashboardAi, type UserBehaviorEvent } from '../personalized-dashboard-ai';

describe('PersonalizedDashboardAi', () => {
  const svc = new PersonalizedDashboardAi();

  const events: UserBehaviorEvent[] = [
    { userId: 'u1', widgetId: 'audit-log', action: 'click', timestamp: 1 },
    { userId: 'u1', widgetId: 'audit-log', action: 'click', timestamp: 2 },
    { userId: 'u1', widgetId: 'audit-log', action: 'dwell', durationMs: 30000, timestamp: 3 },
    { userId: 'u1', widgetId: 'user-mgmt', action: 'view', timestamp: 4 },
  ];

  it('aggregates widget usage', () => {
    const usage = svc.aggregateUsage(events);
    const audit = usage.get('audit-log');
    expect(audit?.clickCount).toBe(2);
    expect(audit?.totalDwellMs).toBe(30000);
  });

  it('returns default layout by role', () => {
    const admin = svc.defaultLayout('admin');
    expect(admin.length).toBe(3);
    expect(svc.defaultLayout('viewer').length).toBe(1);
  });

  it('optimizes layout by usage', () => {
    const usage = svc.aggregateUsage(events);
    const proposal = svc.optimizeLayout('u1', 'admin', usage);
    expect(proposal.widgets[0]?.widgetId).toBe('audit-log');
  });

  it('assigns variant deterministically', () => {
    const variants = [
      { variantId: 'A', userIds: [], widgets: [] },
      { variantId: 'B', userIds: [], widgets: [] },
    ];
    const v1 = svc.assignVariant('alice', variants);
    const v2 = svc.assignVariant('alice', variants);
    expect(v1).toBe(v2);
  });
});
