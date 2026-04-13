import { describe, it, expect, beforeEach } from 'vitest';
import { PublicDataQualityAI } from '../public-data-quality-ai';

describe('PublicDataQualityAI', () => {
  let ai: PublicDataQualityAI;

  beforeEach(() => {
    ai = new PublicDataQualityAI();
  });

  it('데이터셋을 등록한다', () => {
    ai.registerDataset({
      datasetId: 'd1',
      name: '공공 와이파이 AP',
      owner: '과기부',
      expectedFields: ['name', 'lat', 'lng', 'ssid'],
      updateFrequencyDays: 30,
    });
    expect(ai.listDatasets().length).toBe(1);
  });

  it('샘플을 제출한다', () => {
    ai.registerDataset({
      datasetId: 'd1',
      name: 'A',
      owner: 'X',
      expectedFields: ['a', 'b'],
      updateFrequencyDays: 7,
    });
    ai.submitSample({
      datasetId: 'd1',
      rowCount: 1000,
      missingFieldCounts: { a: 10, b: 20 },
      invalidRowCount: 5,
      lastUpdatedAt: '2026-04-10T00:00:00Z',
    });
    expect(ai.getSample('d1')?.rowCount).toBe(1000);
  });

  it('고품질 데이터셋을 A등급으로 평가한다', () => {
    ai.registerDataset({
      datasetId: 'd1',
      name: 'A',
      owner: 'X',
      expectedFields: ['f1', 'f2'],
      updateFrequencyDays: 30,
    });
    ai.submitSample({
      datasetId: 'd1',
      rowCount: 1000,
      missingFieldCounts: { f1: 0, f2: 0 },
      invalidRowCount: 0,
      lastUpdatedAt: '2026-04-13T00:00:00Z',
    });
    const report = ai.evaluate('d1', '2026-04-13T01:00:00Z');
    expect(report.grade).toBe('A');
    expect(report.completeness).toBe(100);
    expect(report.accuracy).toBe(100);
  });

  it('오래된 데이터셋은 적시성이 낮다', () => {
    ai.registerDataset({
      datasetId: 'd1',
      name: 'A',
      owner: 'X',
      expectedFields: ['f1'],
      updateFrequencyDays: 7,
    });
    ai.submitSample({
      datasetId: 'd1',
      rowCount: 100,
      missingFieldCounts: { f1: 0 },
      invalidRowCount: 0,
      lastUpdatedAt: '2026-01-01T00:00:00Z',
    });
    const report = ai.evaluate('d1', '2026-04-13T00:00:00Z');
    expect(report.timeliness).toBeLessThan(70);
    expect(report.issues.some(i => i.includes('적시성'))).toBe(true);
  });

  it('무효 행 수가 전체 행 수를 초과하면 거부한다', () => {
    ai.registerDataset({
      datasetId: 'd1',
      name: 'A',
      owner: 'X',
      expectedFields: ['f'],
      updateFrequencyDays: 7,
    });
    expect(() =>
      ai.submitSample({
        datasetId: 'd1',
        rowCount: 10,
        missingFieldCounts: {},
        invalidRowCount: 20,
        lastUpdatedAt: '2026-04-01T00:00:00Z',
      }),
    ).toThrow('초과');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerDataset(
        {
          datasetId: 'd1',
          name: 'X',
          owner: 'X',
          expectedFields: ['f'],
          updateFrequencyDays: 7,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
