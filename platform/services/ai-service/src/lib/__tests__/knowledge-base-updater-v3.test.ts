import { describe, it, expect } from 'vitest';
import { KnowledgeBaseUpdaterV3 } from '../knowledge-base-updater-v3.js';

describe('SVC-AI-ADV-R602 (v3) KnowledgeBaseUpdaterV3', () => {
  const svc = new KnowledgeBaseUpdaterV3();
  const now = new Date('2026-04-14T00:00:00Z');

  it('FR-R602v3.2: C등급 → BLOCKED', () => {
    expect(() =>
      svc.update(
        [
          {
            id: 'k1',
            title: 'doc',
            grade: 'C',
            updatedAt: '2026-04-01T00:00:00Z',
            ttlDays: 30,
          },
        ],
        now
      )
    ).toThrow(/BLOCKED.*N2SF N-05/);
  });

  it('FR-R602v3.3: TTL 초과 → EXPIRED', () => {
    const r = svc.update(
      [
        {
          id: 'k2',
          title: 'old',
          grade: 'O',
          updatedAt: '2026-01-01T00:00:00Z',
          ttlDays: 30,
        },
      ],
      now
    );
    expect(r.expired).toBe(1);
    expect(r.items[0]?.status).toBe('EXPIRED');
  });

  it('FR-R602v3.4: TTL 이내 → ACTIVE', () => {
    const r = svc.update(
      [
        {
          id: 'k3',
          title: 'new',
          grade: 'O',
          updatedAt: '2026-04-10T00:00:00Z',
          ttlDays: 30,
        },
      ],
      now
    );
    expect(r.active).toBe(1);
    expect(r.items[0]?.status).toBe('ACTIVE');
  });

  it('FR-R602v3.5: 혼합 카운트', () => {
    const r = svc.update(
      [
        {
          id: 'k4',
          title: 'a',
          grade: 'O',
          updatedAt: '2026-04-10T00:00:00Z',
          ttlDays: 30,
        },
        {
          id: 'k5',
          title: 'b',
          grade: 'O',
          updatedAt: '2025-01-01T00:00:00Z',
          ttlDays: 30,
        },
      ],
      now
    );
    expect(r.active).toBe(1);
    expect(r.expired).toBe(1);
  });

  it('감사 로그 기록', () => {
    const local = new KnowledgeBaseUpdaterV3();
    local.update(
      [
        {
          id: 'k6',
          title: 'c',
          grade: 'O',
          updatedAt: '2026-04-13T00:00:00Z',
          ttlDays: 7,
        },
      ],
      now
    );
    const log = local.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.action).toBe('KB_UPDATE');
  });
});
