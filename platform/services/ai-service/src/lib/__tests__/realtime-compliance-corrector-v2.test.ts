import { describe, it, expect, beforeEach } from 'vitest';
import { DisasterRecoveryPrioritizer, type Facility } from '../realtime-compliance-corrector-v2';

describe('DisasterRecoveryPrioritizer', () => {
  let prioritizer: DisasterRecoveryPrioritizer;

  beforeEach(() => {
    prioritizer = new DisasterRecoveryPrioritizer();
  });

  it('assigns rank 1 to highest scored facility', () => {
    const facilities: Facility[] = [
      { id: 'F1', type: 'hospital', damage: 0.9, residents: 5000, criticality: 'high' },
      { id: 'F2', type: 'road', damage: 0.3, residents: 1000, criticality: 'low' },
    ];
    const result = prioritizer.prioritize(facilities);
    expect(result[0]!.id).toBe('F1');
    expect(result[0]!.rank).toBe(1);
  });

  it('computes score with formula damage*0.4 + min(residents/10000,1)*0.3 + critW/3*0.3', () => {
    const facilities: Facility[] = [
      { id: 'F3', type: 'school', damage: 1.0, residents: 10000, criticality: 'high' },
    ];
    const result = prioritizer.prioritize(facilities);
    // score = 1.0*0.4 + 1.0*0.3 + 3/3*0.3 = 0.4+0.3+0.3 = 1.0
    expect(result[0]!.score).toBeCloseTo(1.0, 2);
  });

  it('caps resident factor at 1 for > 10000 residents', () => {
    const facilities: Facility[] = [
      { id: 'F4', type: 'stadium', damage: 0.5, residents: 50000, criticality: 'med' },
    ];
    const result = prioritizer.prioritize(facilities);
    // min(50000/10000,1) = 1.0; critW=2; score=0.5*0.4+1.0*0.3+2/3*0.3=0.2+0.3+0.2=0.7
    expect(result[0]!.score).toBeCloseTo(0.7, 2);
  });

  it('returns empty for no facilities', () => {
    const result = prioritizer.prioritize([]);
    expect(result).toHaveLength(0);
  });

  it('marks top facility as urgent', () => {
    const facilities: Facility[] = [
      { id: 'F5', type: 'bridge', damage: 1.0, residents: 10000, criticality: 'high' },
      { id: 'F6', type: 'park', damage: 0.1, residents: 100, criticality: 'low' },
    ];
    const result = prioritizer.prioritize(facilities);
    const top = result.find(p => p.rank === 1)!;
    expect(top.urgent).toBe(true);
  });

  it('records audit log', () => {
    prioritizer.prioritize([
      { id: 'F7', type: 'x', damage: 0.5, residents: 1000, criticality: 'med' },
    ]);
    const log = prioritizer.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.action).toBe('disaster.prioritize');
  });
});
