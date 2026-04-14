import { describe, it, expect, beforeEach } from 'vitest';
import { AIDataStewardV2 } from '../ai-data-steward-v2';

describe('AIDataStewardV2', () => {
  let steward: AIDataStewardV2;

  beforeEach(() => {
    steward = new AIDataStewardV2();
    steward.registerDataset({ datasetId: 'ds1', owner: 'team-a', qualityScore: 90 });
  });

  it('returns HEALTHY for high quality with no issues then first issue stays HEALTHY', () => {
    const v = steward.reportIssue({ datasetId: 'ds1', stewardId: '900101-1', description: 'x' });
    expect(v.score).toBe(85);
    expect(v.status).toBe('HEALTHY');
    expect(v.maskedStewardId).toHaveLength(16);
    expect(v.maskedStewardId).not.toContain('900101');
  });

  it('transitions to REVIEW after accumulated issues', () => {
    for (let i = 0; i < 3; i++) {
      steward.reportIssue({ datasetId: 'ds1', stewardId: 's', description: 'x' });
    }
    const v = steward.reportIssue({ datasetId: 'ds1', stewardId: 's', description: 'x' });
    expect(v.score).toBe(70);
    expect(v.status).toBe('REVIEW');
  });

  it('transitions to ACTION_REQUIRED and lists at-risk datasets', () => {
    for (let i = 0; i < 9; i++) {
      steward.reportIssue({ datasetId: 'ds1', stewardId: 's', description: 'x' });
    }
    expect(steward.getAtRisk()).toEqual(['ds1']);
    const v = steward.reportIssue({ datasetId: 'ds1', stewardId: 's', description: 'x' });
    expect(v.status).toBe('ACTION_REQUIRED');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      steward.reportIssue({ datasetId: 'ds1', stewardId: 's', description: 'x' }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      steward.reportIssue({ datasetId: 'ds1', stewardId: 's', description: 'x' }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown dataset and invalid quality', () => {
    expect(() =>
      steward.reportIssue({ datasetId: 'missing', stewardId: 's', description: 'x' }),
    ).toThrow('UNKNOWN_DATASET');
    expect(() => steward.registerDataset({ datasetId: 'x', owner: 'y', qualityScore: 150 })).toThrow(
      'INVALID_QUALITY',
    );
  });

  it('audit log masks steward id and records register + report', () => {
    steward.reportIssue({ datasetId: 'ds1', stewardId: '900101-1234567', description: 'x' });
    const log = steward.getAuditLog();
    expect(log.some((e) => e.action === 'REGISTER_DATASET')).toBe(true);
    expect(log.some((e) => e.action === 'REPORT_ISSUE')).toBe(true);
    for (const entry of log) {
      expect(JSON.stringify(entry.details ?? {})).not.toContain('900101');
    }
  });
});
