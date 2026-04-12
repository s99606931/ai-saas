import { describe, it, expect, beforeEach } from 'vitest';
import { PublicAuditAutomationAI } from '../public-audit-automation-ai';

describe('PublicAuditAutomationAI', () => {
  let audit: PublicAuditAutomationAI;

  beforeEach(() => {
    audit = new PublicAuditAutomationAI();
  });

  it('체크리스트 항목을 등록한다', () => {
    audit.registerChecklistItem('D-06', '침해사고 관리', '감사 로그 유지', 3);
    const logs = audit.getAuditLog();
    expect(logs.some(l => l.action === 'REGISTER_CHECKLIST_ITEM')).toBe(true);
  });

  it('감사 이벤트를 기록하고 준수 여부를 체크한다', () => {
    audit.registerChecklistItem('D-06', '침해사고', '감사 로그', 3);
    audit.recordAuditEvent('D-06', true, '감사 로그 1년치 유지 확인');
    const result = audit.checkCompliance('D-06');
    expect(result.passed).toBe(true);
  });

  it('이벤트 없는 항목은 미통과로 반환한다', () => {
    audit.registerChecklistItem('D-08', '접근 제어', 'RBAC 설정', 2);
    const result = audit.checkCompliance('D-08');
    expect(result.passed).toBe(false);
    expect(result.lastCheckedAt).toBeNull();
  });

  it('준수율을 가중치 기반으로 계산한다', () => {
    audit.registerChecklistItem('item-1', 'A', '설명1', 4);
    audit.registerChecklistItem('item-2', 'B', '설명2', 1);
    audit.recordAuditEvent('item-1', true, '통과');
    audit.recordAuditEvent('item-2', false, '미흡');
    const report = audit.generateReport();
    expect(report.complianceRate).toBe(80);
  });

  it('미흡 항목이 가중치 내림차순으로 정렬된다', () => {
    audit.registerChecklistItem('low', 'A', '낮은 중요도', 1);
    audit.registerChecklistItem('high', 'A', '높은 중요도', 5);
    audit.recordAuditEvent('low', false, '미흡');
    audit.recordAuditEvent('high', false, '미흡');
    const report = audit.generateReport();
    expect(report.failedItems[0]!.itemId).toBe('high');
  });

  it('C등급 데이터 전송을 차단한다', () => {
    audit.registerChecklistItem('item-1', 'A', '설명', 1);
    expect(() => audit.recordAuditEvent('item-1', true, '근거', 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 항목에 이벤트 기록 시 오류를 던진다', () => {
    expect(() => audit.recordAuditEvent('unknown', true, '근거')).toThrow('체크리스트 항목 미등록');
  });

  it('모든 항목 통과 시 준수율 100%이다', () => {
    audit.registerChecklistItem('a', 'X', '설명', 2);
    audit.registerChecklistItem('b', 'X', '설명', 3);
    audit.recordAuditEvent('a', true, '통과');
    audit.recordAuditEvent('b', true, '통과');
    const report = audit.generateReport();
    expect(report.complianceRate).toBe(100);
    expect(report.failedItems.length).toBe(0);
  });

  it('카테고리별 권고사항을 생성한다', () => {
    audit.registerChecklistItem('c1', '보안', '암호화', 3);
    audit.registerChecklistItem('c2', '보안', '접근제어', 2);
    audit.recordAuditEvent('c1', false, '미흡');
    audit.recordAuditEvent('c2', false, '미흡');
    const report = audit.generateReport();
    expect(report.recommendations.some(r => r.includes('보안'))).toBe(true);
  });
});
