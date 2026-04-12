// MTU-N341 정부 KPI 분석 테스트
import { describe, it, expect } from 'vitest';
import { GovKPIAnalyzerService } from '../gov-kpi-analyzer.js';

describe('MTU-N341 GovKPIAnalyzer', () => {
  const svc = new GovKPIAnalyzerService('tenant-n341');

  it('FR-N341.1: KPI 등록', () => {
    const kpi = svc.register('고객만족도', 'customer', 85, '%', 30);
    expect(kpi).toBeDefined();
  });

  it('FR-N341.2: KPI 평가', () => {
    const kpi = svc.register('처리시간', 'process', 5, 'days', 25);
    const result = svc.evaluate(kpi, 4);
    expect(result).toBeDefined();
  });

  it('FR-N341.3: BSC 점수', () => {
    const kpi1 = svc.register('재무건전성', 'financial', 90, 'pts', 25);
    const kpi2 = svc.register('학습성장', 'learning', 80, 'pts', 20);
    const r1 = svc.evaluate(kpi1, 85);
    const r2 = svc.evaluate(kpi2, 75);
    const bsc = svc.bsc([r1, r2]);
    expect(bsc).toBeDefined();
  });

  it('FR-N341.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
