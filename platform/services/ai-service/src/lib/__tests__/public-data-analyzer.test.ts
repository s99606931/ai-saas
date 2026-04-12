// MTU-N356 공공 데이터 분석 테스트
import { describe, it, expect } from 'vitest';
import { PublicDataAnalyzerService } from '../public-data-analyzer.js';

describe('MTU-N356 PublicDataAnalyzer', () => {
  const svc = new PublicDataAnalyzerService('tenant-n356');

  it('FR-N356.1: 데이터셋 분석', () => {
    const summary = svc.analyze([
      { id: '1', name: 'Alice', age: '30' },
      { id: '2', name: 'Bob', age: '25' },
      { id: '3', name: 'Charlie', age: null },
    ]);
    expect(summary).toBeDefined();
  });

  it('FR-N356.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
