import { describe, it, expect } from 'vitest';
import { OnCallFatigue, type OnCallShift } from '../oncall-fatigue';

describe('OnCallFatigue', () => {
  const svc = new OnCallFatigue();

  const heavyShifts: OnCallShift[] = [
    {
      engineerId: 'E1',
      startAt: '2026-04-01T00:00:00Z',
      endAt: '2026-04-01T12:00:00Z',
      nightHours: 8,
      incidentsHandled: 5,
      pagesReceived: 12,
    },
    {
      engineerId: 'E1',
      startAt: '2026-04-02T00:00:00Z',
      endAt: '2026-04-02T12:00:00Z',
      nightHours: 12,
      incidentsHandled: 6,
      pagesReceived: 10,
    },
    {
      engineerId: 'E1',
      startAt: '2026-04-03T00:00:00Z',
      endAt: '2026-04-03T12:00:00Z',
      nightHours: 6,
      incidentsHandled: 4,
      pagesReceived: 5,
    },
  ];

  it('calculates high fatigue for heavy oncall', () => {
    const fatigue = svc.calculateFatigue('E1', heavyShifts);
    expect(fatigue.level).not.toBe('ok');
    expect(fatigue.reasons.length).toBeGreaterThan(0);
  });

  it('returns ok for no shifts', () => {
    const fatigue = svc.calculateFatigue('E2', heavyShifts);
    expect(fatigue.level).toBe('ok');
    expect(fatigue.score).toBe(0);
  });

  it('identifies engineers needing warning', () => {
    const warnings = svc.getWarnings(['E1', 'E2'], heavyShifts);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('proposes fair schedule to least fatigued', () => {
    const existing: OnCallShift[] = [
      {
        engineerId: 'E1',
        startAt: '2026-04-01T00:00:00Z',
        endAt: '2026-04-01T12:00:00Z',
        nightHours: 30,
        incidentsHandled: 12,
        pagesReceived: 25,
      },
      {
        engineerId: 'E1',
        startAt: '2026-04-02T00:00:00Z',
        endAt: '2026-04-02T12:00:00Z',
        nightHours: 30,
        incidentsHandled: 12,
        pagesReceived: 25,
      },
    ];
    const proposal = svc.proposeFairSchedule(['E1', 'E2'], existing, '2026-04-10T00:00:00Z', 12);
    expect(proposal).not.toBeNull();
    expect(proposal!.engineerId).toBe('E2');
  });

  it('builds team dashboard', () => {
    const dashboard = svc.teamDashboard(['E1', 'E2', 'E3'], heavyShifts);
    expect(dashboard.totalEngineers).toBe(3);
    expect(dashboard.avgFatigue).toBeGreaterThanOrEqual(0);
  });
});
