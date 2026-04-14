import { describe, it, expect } from 'vitest';
import { DocumentLifecycleManagerV3 } from '../document-lifecycle-manager-v3.js';

describe('SVC-AI-ADV-R608 (v3) DocumentLifecycleManagerV3', () => {
  const svc = new DocumentLifecycleManagerV3();
  const now = new Date('2026-04-14T00:00:00Z');

  it('FR-R608v3.3: PERMANENT → ARCHIVE', () => {
    const r = svc.classify(
      [
        {
          id: 'd1',
          createdAt: '2020-01-01T00:00:00Z',
          retentionYears: 5,
          accessCount: 0,
          classification: 'PERMANENT',
        },
      ],
      now
    );
    expect(r.items[0]?.stage).toBe('ARCHIVE');
  });

  it('FR-R608v3.3: 만료 → DISPOSAL', () => {
    const r = svc.classify(
      [
        {
          id: 'd2',
          createdAt: '2018-01-01T00:00:00Z',
          retentionYears: 5,
          accessCount: 0,
          classification: 'STANDARD',
        },
      ],
      now
    );
    expect(r.items[0]?.stage).toBe('DISPOSAL');
    expect(r.disposalCandidates).toContain('d2');
  });

  it('FR-R608v3.3: 80% 도달 → REVIEW', () => {
    const r = svc.classify(
      [
        {
          id: 'd3',
          createdAt: '2022-04-14T00:00:00Z',
          retentionYears: 5,
          accessCount: 0,
          classification: 'STANDARD',
        },
      ],
      now
    );
    // ageYears ≈ 4, 5*0.8=4 → REVIEW
    expect(r.items[0]?.stage).toBe('REVIEW');
  });

  it('FR-R608v3.3: 신규 → ACTIVE', () => {
    const r = svc.classify(
      [
        {
          id: 'd4',
          createdAt: '2025-01-01T00:00:00Z',
          retentionYears: 10,
          accessCount: 5,
          classification: 'STANDARD',
        },
      ],
      now
    );
    expect(r.items[0]?.stage).toBe('ACTIVE');
  });

  it('FR-R608v3.4: disposalCandidates 추출', () => {
    const r = svc.classify(
      [
        {
          id: 'd5',
          createdAt: '2010-01-01T00:00:00Z',
          retentionYears: 5,
          accessCount: 0,
          classification: 'STANDARD',
        },
        {
          id: 'd6',
          createdAt: '2025-01-01T00:00:00Z',
          retentionYears: 10,
          accessCount: 0,
          classification: 'STANDARD',
        },
      ],
      now
    );
    expect(r.disposalCandidates).toEqual(['d5']);
  });

  it('FR-R608v3.5: 감사 로그', () => {
    const local = new DocumentLifecycleManagerV3();
    local.classify([], now);
    expect(local.getAuditLog()).toHaveLength(1);
  });
});
