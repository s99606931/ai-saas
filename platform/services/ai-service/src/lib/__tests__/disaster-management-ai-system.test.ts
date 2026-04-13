import { describe, it, expect, beforeEach } from 'vitest';
import { DisasterManagementAISystem } from '../disaster-management-ai-system';

describe('DisasterManagementAISystem', () => {
  let ai: DisasterManagementAISystem;

  beforeEach(() => {
    ai = new DisasterManagementAISystem();
  });

  it('재난 이벤트를 등록한다', () => {
    ai.reportEvent({
      eventId: 'e1',
      type: 'flood',
      region: 'seoul',
      reportedAt: '2026-04-13T09:00:00Z',
      affectedPopulation: 5000,
      estimatedDamage: 1500,
    });
    expect(ai.getAuditLog().some(a => a.action === 'REPORT_EVENT')).toBe(true);
  });

  it('심각도를 평가한다 (critical)', () => {
    ai.reportEvent({
      eventId: 'e1',
      type: 'earthquake',
      region: 'busan',
      reportedAt: 't',
      affectedPopulation: 8000,
      estimatedDamage: 3000,
    });
    const result = ai.evaluateSeverity('e1');
    expect(result.severity).toBe('critical');
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('심각도를 평가한다 (warning)', () => {
    ai.reportEvent({
      eventId: 'e1',
      type: 'fire',
      region: 'daegu',
      reportedAt: 't',
      affectedPopulation: 3500,
      estimatedDamage: 400,
    });
    const result = ai.evaluateSeverity('e1');
    expect(['warning', 'alert']).toContain(result.severity);
  });

  it('자원을 배정한다', () => {
    ai.reportEvent({
      eventId: 'e1',
      type: 'flood',
      region: 'seoul',
      reportedAt: 't',
      affectedPopulation: 500,
      estimatedDamage: 100,
    });
    ai.registerResource({ resourceId: 'r1', kind: 'pump', capacity: 3, region: 'seoul' });
    ai.registerResource({ resourceId: 'r2', kind: 'truck', capacity: 5, region: 'seoul' });
    const allocs = ai.allocateResources('e1');
    expect(allocs.length).toBeGreaterThan(0);
    expect(ai.listAllocations('e1').length).toBe(allocs.length);
  });

  it('음수 인구는 거부한다', () => {
    expect(() =>
      ai.reportEvent({
        eventId: 'e1',
        type: 'other',
        region: 'r',
        reportedAt: 't',
        affectedPopulation: -1,
        estimatedDamage: 0,
      }),
    ).toThrow('영향 인구');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.reportEvent(
        {
          eventId: 'e1',
          type: 'other',
          region: 'r',
          reportedAt: 't',
          affectedPopulation: 1,
          estimatedDamage: 1,
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
