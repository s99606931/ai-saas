import { describe, it, expect, beforeEach } from 'vitest';
import { ContractFulfillmentMonitor, type Milestone } from '../budget-allocation-optimizer-ai';

describe('ContractFulfillmentMonitor', () => {
  let monitor: ContractFulfillmentMonitor;

  beforeEach(() => {
    monitor = new ContractFulfillmentMonitor();
  });

  it('marks 100% progress milestone as DONE', () => {
    const milestones: Milestone[] = [
      { id: 'M1', dueDate: '2026-05-01', progress: 100, weight: 1 },
    ];
    const report = monitor.analyze(milestones, { today: '2026-04-01' });
    expect(report.statuses[0]!.status).toBe('DONE');
  });

  it('marks past-due milestone as OVERDUE', () => {
    const milestones: Milestone[] = [
      { id: 'M2', dueDate: '2026-03-01', progress: 50, weight: 1 },
    ];
    const report = monitor.analyze(milestones, { today: '2026-04-01' });
    expect(report.statuses[0]!.status).toBe('OVERDUE');
  });

  it('marks AT_RISK when less than 14 days and progress < 80', () => {
    const milestones: Milestone[] = [
      { id: 'M3', dueDate: '2026-04-10', progress: 60, weight: 1 },
    ];
    const report = monitor.analyze(milestones, { today: '2026-04-01' });
    expect(report.statuses[0]!.status).toBe('AT_RISK');
  });

  it('marks ON_TRACK for normal in-progress milestone', () => {
    const milestones: Milestone[] = [
      { id: 'M4', dueDate: '2026-06-01', progress: 50, weight: 1 },
    ];
    const report = monitor.analyze(milestones, { today: '2026-04-01' });
    expect(report.statuses[0]!.status).toBe('ON_TRACK');
  });

  it('computes weighted overall progress', () => {
    const milestones: Milestone[] = [
      { id: 'M5', dueDate: '2026-06-01', progress: 100, weight: 2 },
      { id: 'M6', dueDate: '2026-06-01', progress: 0, weight: 1 },
    ];
    const report = monitor.analyze(milestones, { today: '2026-04-01' });
    // (100*2 + 0*1) / 3 = 66.7
    expect(report.overallProgress).toBeCloseTo(66.7, 0);
  });

  it('records audit log on analyze', () => {
    monitor.analyze(
      [{ id: 'M7', dueDate: '2026-06-01', progress: 50, weight: 1 }],
      { today: '2026-04-01' }
    );
    const log = monitor.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.action).toBe('contract.analyze');
  });

  it('handles empty milestones', () => {
    const report = monitor.analyze([], { today: '2026-04-01' });
    expect(report.overallProgress).toBe(0);
    expect(report.statuses).toHaveLength(0);
  });
});
