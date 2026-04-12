// MTU-N343 컴플라이언스 Gap 분석 테스트
import { describe, it, expect } from 'vitest';
import { ComplianceGapFinderService } from '../compliance-gap-finder.js';

describe('MTU-N343 ComplianceGapFinder', () => {
  const svc = new ComplianceGapFinderService('tenant-n343');

  it('FR-N343.1: 항목 등록', () => {
    const item = svc.register('CSAP', 'D-08', '접근 통제', 'high');
    expect(item).toBeDefined();
  });

  it('FR-N343.2: Gap 분석', () => {
    const item = svc.register('ISMS-P', 'P-01', '개인정보보호', 'critical');
    const statuses = [
      { itemId: item.itemId, status: 'partial' as const, evidence: '일부 구현됨', assessedAt: '2026-04-11' },
    ];
    const report = svc.analyze(statuses);
    expect(report).toBeDefined();
  });

  it('FR-N343.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
