import { describe, it, expect, beforeEach } from 'vitest';
import { PublicServiceAccessibilityAssessorV3, type AccessibilityCheck } from '../public-service-accessibility-assessor-v3';

describe('PublicServiceAccessibilityAssessorV3', () => {
  let assessor: PublicServiceAccessibilityAssessorV3;

  beforeEach(() => {
    assessor = new PublicServiceAccessibilityAssessorV3();
  });

  it('grades A for all criteria met (score=100)', () => {
    const checks: AccessibilityCheck[] = [
      { serviceId: 'SVC1', hasAltText: true, hasKeyboardNav: true, hasColorContrast: true, hasCaptionVideo: true, hasScreenReader: true },
    ];
    const result = assessor.assess(checks);
    expect(result[0]!.score).toBe(100);
    expect(result[0]!.grade).toBe('A');
    expect(result[0]!.missing).toHaveLength(0);
  });

  it('grades D for no criteria met (score=0)', () => {
    const checks: AccessibilityCheck[] = [
      { serviceId: 'SVC2', hasAltText: false, hasKeyboardNav: false, hasColorContrast: false, hasCaptionVideo: false, hasScreenReader: false },
    ];
    const result = assessor.assess(checks);
    expect(result[0]!.score).toBe(0);
    expect(result[0]!.grade).toBe('D');
    expect(result[0]!.missing).toHaveLength(5);
  });

  it('grades B for 3 criteria met (score=60)', () => {
    const checks: AccessibilityCheck[] = [
      { serviceId: 'SVC3', hasAltText: true, hasKeyboardNav: true, hasColorContrast: true, hasCaptionVideo: false, hasScreenReader: false },
    ];
    const result = assessor.assess(checks);
    expect(result[0]!.score).toBe(60);
    expect(result[0]!.grade).toBe('B');
  });

  it('grades C for 2 criteria met (score=40)', () => {
    const checks: AccessibilityCheck[] = [
      { serviceId: 'SVC4', hasAltText: true, hasKeyboardNav: true, hasColorContrast: false, hasCaptionVideo: false, hasScreenReader: false },
    ];
    const result = assessor.assess(checks);
    expect(result[0]!.score).toBe(40);
    expect(result[0]!.grade).toBe('C');
  });

  it('lists missing criteria by name', () => {
    const checks: AccessibilityCheck[] = [
      { serviceId: 'SVC5', hasAltText: false, hasKeyboardNav: true, hasColorContrast: true, hasCaptionVideo: false, hasScreenReader: true },
    ];
    const result = assessor.assess(checks);
    expect(result[0]!.missing).toContain('altText');
    expect(result[0]!.missing).toContain('captionVideo');
    expect(result[0]!.missing).not.toContain('keyboardNav');
  });

  it('records audit log', () => {
    assessor.assess([
      { serviceId: 'SVC6', hasAltText: true, hasKeyboardNav: true, hasColorContrast: true, hasCaptionVideo: true, hasScreenReader: false },
    ]);
    const log = assessor.getAuditLog();
    expect(log[0]!.action).toBe('accessibility.assess');
  });
});
