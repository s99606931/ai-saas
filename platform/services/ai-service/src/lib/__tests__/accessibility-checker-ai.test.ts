import { describe, it, expect, beforeEach } from 'vitest';
import { AccessibilityCheckerAI } from '../accessibility-checker-ai';

describe('AccessibilityCheckerAI', () => {
  let checker: AccessibilityCheckerAI;

  beforeEach(() => {
    checker = new AccessibilityCheckerAI();
  });

  it('규칙을 등록한다', () => {
    checker.registerRule('r1', 'WCAG 1.1.1', 'img alt 텍스트 필수', 'error', 'alt', '');
    const logs = checker.getAuditLog();
    expect(logs.some(l => l.action === 'REGISTER_RULE')).toBe(true);
  });

  it('alt 속성 누락 위반을 탐지한다', () => {
    checker.registerRule('r1', 'WCAG 1.1.1', 'img alt 필수', 'error', 'alt', '');
    const result = checker.checkPage('page-1', [
      { elementId: 'img-1', type: 'img', attributes: {} },
    ]);
    expect(result.violations.length).toBe(1);
    expect(result.violations[0]!.ruleId).toBe('r1');
  });

  it('위반 없으면 준수율 100%이다', () => {
    checker.registerRule('r1', 'WCAG 1.1.1', 'img alt 필수', 'error', 'alt', '');
    checker.checkPage('page-2', [
      { elementId: 'img-1', type: 'img', attributes: { alt: '로고 이미지' } },
    ]);
    const report = checker.getReport('page-2');
    expect(report.complianceRate).toBe(100);
    expect(report.violations.length).toBe(0);
  });

  it('검사 없는 페이지는 준수율 100%이다', () => {
    const report = checker.getReport('unknown-page');
    expect(report.complianceRate).toBe(100);
  });

  it('여러 위반이 심각도 순으로 정렬된다', () => {
    checker.registerRule('r1', 'WCAG 1.1.1', 'alt 필수', 'critical', 'alt', '');
    checker.registerRule('r2', 'WCAG 2.4.4', '링크 텍스트', 'warning', 'aria-label', '');
    checker.checkPage('page-3', [
      { elementId: 'el-1', type: 'img', attributes: {} },
      { elementId: 'el-2', type: 'a', attributes: {} },
    ]);
    const report = checker.getReport('page-3');
    expect(report.violations[0]!.severity).toBe('critical');
  });

  it('C등급 데이터 전송을 차단한다', () => {
    expect(() => checker.checkPage('page', [], 'C' as never)).toThrow('BLOCKED');
  });

  it('보고서에 권고사항이 포함된다', () => {
    checker.registerRule('r1', 'WCAG 1.1.1', 'alt 필수', 'error', 'alt', '');
    checker.checkPage('page-4', [{ elementId: 'img-1', type: 'img', attributes: {} }]);
    const report = checker.getReport('page-4');
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});
