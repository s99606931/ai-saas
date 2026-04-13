import { describe, it, expect } from 'vitest';
import { OpenDataQualityManagerAI } from '../opendata-quality-manager-ai.js';

describe('SVC-AI-ADV-R439 OpenDataQualityManagerAI', () => {
  const svc = new OpenDataQualityManagerAI();
  const now = new Date().toISOString();
  const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();

  it('FR-439.5: 최상 데이터 → A 등급', () => {
    const s = svc.score({
      datasetId: 'D1',
      totalRows: 1000,
      nullCount: 0,
      invalidCount: 0,
      schemaViolations: 0,
      lastUpdated: now,
    });
    expect(s.grade).toBe('A');
    expect(s.overall).toBeGreaterThanOrEqual(0.9);
  });

  it('FR-439.1~4: 각 차원 계산', () => {
    const s = svc.score({
      datasetId: 'D1',
      totalRows: 100,
      nullCount: 10,
      invalidCount: 5,
      schemaViolations: 2,
      lastUpdated: now,
    });
    expect(s.completeness).toBe(0.9);
    expect(s.accuracy).toBe(0.95);
    expect(s.consistency).toBe(0.98);
  });

  it('FR-439.2: 오래된 데이터 → freshness 낮음', () => {
    const s = svc.score({
      datasetId: 'D1',
      totalRows: 100,
      nullCount: 0,
      invalidCount: 0,
      schemaViolations: 0,
      lastUpdated: oldDate,
    });
    expect(s.freshness).toBe(0.3);
  });

  it('FR-439.5: 저품질 → D', () => {
    const s = svc.score({
      datasetId: 'D1',
      totalRows: 100,
      nullCount: 80,
      invalidCount: 80,
      schemaViolations: 80,
      lastUpdated: oldDate,
    });
    expect(s.grade).toBe('D');
  });

  it('totalRows=0 → 오류', () => {
    expect(() =>
      svc.score({
        datasetId: 'D1',
        totalRows: 0,
        nullCount: 0,
        invalidCount: 0,
        schemaViolations: 0,
        lastUpdated: now,
      }),
    ).toThrow('INVALID_ROWS');
  });

  it('N2SF C 차단', () => {
    expect(() =>
      svc.score(
        {
          datasetId: 'D1',
          totalRows: 10,
          nullCount: 0,
          invalidCount: 0,
          schemaViolations: 0,
          lastUpdated: now,
        },
        'C',
      ),
    ).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.score({
      datasetId: 'D1',
      totalRows: 10,
      nullCount: 0,
      invalidCount: 0,
      schemaViolations: 0,
      lastUpdated: now,
    });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
