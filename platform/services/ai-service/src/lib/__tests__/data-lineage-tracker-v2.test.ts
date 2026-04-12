import { describe, it, expect } from 'vitest';
import { DataLineageTrackerV2 } from '../data-lineage-tracker-v2.js';

describe('SVC-AI-ADV-R353 DataLineageTrackerV2', () => {
  it('FR-353.1: 필드 변환 기록', () => {
    const svc = new DataLineageTrackerV2();
    svc.recordTransform({
      source: { datasetId: 'a', field: 'x' },
      target: { datasetId: 'b', field: 'y' },
      transform: 'copy',
    });
    expect(svc.getAuditLog().length).toBe(1);
  });

  it('FR-353.2: downstream 조회', () => {
    const svc = new DataLineageTrackerV2();
    svc.recordTransform({
      source: { datasetId: 'a', field: 'x' },
      target: { datasetId: 'b', field: 'y' },
      transform: 't1',
    });
    svc.recordTransform({
      source: { datasetId: 'b', field: 'y' },
      target: { datasetId: 'c', field: 'z' },
      transform: 't2',
    });
    const down = svc.getDownstream({ datasetId: 'a', field: 'x' });
    expect(down.length).toBe(2);
  });

  it('upstream 조회', () => {
    const svc = new DataLineageTrackerV2();
    svc.recordTransform({
      source: { datasetId: 'a', field: 'x' },
      target: { datasetId: 'b', field: 'y' },
      transform: 't1',
    });
    const up = svc.getUpstream({ datasetId: 'b', field: 'y' });
    expect(up.length).toBe(1);
    expect(up[0]?.datasetId).toBe('a');
  });

  it('FR-353.3: C/S 차단', () => {
    const svc = new DataLineageTrackerV2();
    expect(() =>
      svc.recordTransform(
        {
          source: { datasetId: 'a', field: 'x' },
          target: { datasetId: 'b', field: 'y' },
          transform: 't',
        },
        'C',
      ),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-353.4: 감사 로그', () => {
    const svc = new DataLineageTrackerV2();
    svc.recordTransform({
      source: { datasetId: 'a', field: 'x' },
      target: { datasetId: 'b', field: 'y' },
      transform: 't',
    });
    expect(svc.getAuditLog().length).toBe(1);
  });

  it('순환 방지', () => {
    const svc = new DataLineageTrackerV2();
    svc.recordTransform({
      source: { datasetId: 'a', field: 'x' },
      target: { datasetId: 'b', field: 'y' },
      transform: 't',
    });
    svc.recordTransform({
      source: { datasetId: 'b', field: 'y' },
      target: { datasetId: 'a', field: 'x' },
      transform: 't',
    });
    const down = svc.getDownstream({ datasetId: 'a', field: 'x' });
    expect(down.length).toBe(1);
  });
});
