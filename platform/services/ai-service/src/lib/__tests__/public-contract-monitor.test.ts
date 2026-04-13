import { describe, it, expect } from 'vitest';
import { PublicContractMonitor } from '../public-contract-monitor.js';

describe('SVC-AI-ADV-R448 PublicContractMonitor', () => {
  const svc = new PublicContractMonitor();

  it('FR-448.2: OVERDUE 감지', () => {
    const r = svc.evaluate(
      [{ id: 'm1', dueDate: '2026-01-01', progress: 0.5, weight: 1 }],
      '2026-04-13',
    );
    expect(r.statuses[0]!.status).toBe('OVERDUE');
  });

  it('DONE 상태', () => {
    const r = svc.evaluate(
      [{ id: 'm1', dueDate: '2026-01-01', progress: 1, weight: 1 }],
      '2026-04-13',
    );
    expect(r.statuses[0]!.status).toBe('DONE');
  });

  it('FR-448.3: AT_RISK', () => {
    const r = svc.evaluate(
      [{ id: 'm1', dueDate: '2026-04-15', progress: 0.2, weight: 1 }],
      '2026-04-13',
    );
    expect(r.statuses[0]!.status).toBe('AT_RISK');
  });

  it('ON_TRACK', () => {
    const r = svc.evaluate(
      [{ id: 'm1', dueDate: '2026-12-31', progress: 0.2, weight: 1 }],
      '2026-04-13',
    );
    expect(r.statuses[0]!.status).toBe('ON_TRACK');
  });

  it('FR-448.4: 가중 진척률', () => {
    const r = svc.evaluate(
      [
        { id: 'a', dueDate: '2026-12-31', progress: 0.5, weight: 2 },
        { id: 'b', dueDate: '2026-12-31', progress: 1, weight: 2 },
      ],
      '2026-04-13',
    );
    expect(r.overallProgress).toBe(0.75);
  });

  it('today 오류', () => {
    expect(() => svc.evaluate([], 'invalid')).toThrow('INVALID_TODAY');
  });

  it('progress 범위 오류', () => {
    expect(() =>
      svc.evaluate(
        [{ id: 'a', dueDate: '2026-12-31', progress: 2, weight: 1 }],
        '2026-04-13',
      ),
    ).toThrow('INVALID_PROGRESS');
  });

  it('FR-448.5: S 차단', () => {
    expect(() => svc.evaluate([], '2026-04-13', 'S')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.evaluate([], '2026-04-13');
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
