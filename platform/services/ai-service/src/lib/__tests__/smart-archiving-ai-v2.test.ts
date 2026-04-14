import { describe, it, expect, beforeEach } from 'vitest';
import { SmartArchivingAIV2 } from '../smart-archiving-ai-v2';

const YEAR_MS = 365 * 86400 * 1000;

describe('SmartArchivingAIV2', () => {
  let arc: SmartArchivingAIV2;

  beforeEach(() => {
    arc = new SmartArchivingAIV2();
  });

  it('classifies ACTIVE for young record', () => {
    const r = arc.register({
      recordId: 'r1',
      createdAtMs: Date.now() - YEAR_MS * 1,
      retentionYears: 10,
    });
    expect(r.status).toBe('ACTIVE');
  });

  it('classifies REVIEW when age >= 80% of retention', () => {
    const r = arc.register({
      recordId: 'r1',
      createdAtMs: Date.now() - YEAR_MS * 8.5,
      retentionYears: 10,
    });
    expect(r.status).toBe('REVIEW');
  });

  it('classifies DISPOSAL when age >= retention', () => {
    const r = arc.register({
      recordId: 'r1',
      createdAtMs: Date.now() - YEAR_MS * 11,
      retentionYears: 10,
    });
    expect(r.status).toBe('DISPOSAL');
  });

  it('classifies permanent as ARCHIVE', () => {
    const r = arc.register({
      recordId: 'r1',
      createdAtMs: Date.now() - YEAR_MS * 50,
      retentionYears: 10,
      permanent: true,
    });
    expect(r.status).toBe('ARCHIVE');
  });

  it('lists disposal candidates', () => {
    arc.register({ recordId: 'a', createdAtMs: Date.now() - YEAR_MS * 11, retentionYears: 10 });
    arc.register({ recordId: 'b', createdAtMs: Date.now() - YEAR_MS * 1, retentionYears: 10 });
    expect(arc.getDisposalCandidates().map((e) => e.recordId)).toEqual(['a']);
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      arc.register({ recordId: 'r', createdAtMs: Date.now(), retentionYears: 5 }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      arc.register({ recordId: 'r', createdAtMs: Date.now(), retentionYears: 5 }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('rejects negative retention', () => {
    expect(() =>
      arc.register({ recordId: 'r', createdAtMs: Date.now(), retentionYears: -1 }),
    ).toThrow('INVALID_RETENTION');
  });

  it('maintains audit log', () => {
    arc.register({ recordId: 'r', createdAtMs: Date.now(), retentionYears: 5 });
    expect(arc.getAuditLog().some((e) => e.action === 'REGISTER_RECORD')).toBe(true);
  });
});
