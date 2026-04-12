// MTU-N315 법령 개정 추적 테스트
import { describe, it, expect } from 'vitest';
import { LawRevisionTrackerService } from '../law-revision-tracker.js';

describe('MTU-N315 LawRevisionTracker', () => {
  const svc = new LawRevisionTrackerService('tenant-n315');

  it('FR-N315.1: 법령 등록', () => {
    const law = svc.register('개인정보보호법', '2024-01', 'privacy');
    expect(law).toBeDefined();
  });

  it('FR-N315.2: 개정 탐지', () => {
    const law = svc.register('정보공개법', '2024-01', 'transparency');
    const changes = svc.detect(law.lawId, '제1조 목적 구법', '제1조 목적 신법');
    expect(Array.isArray(changes)).toBe(true);
  });

  it('FR-N315.3: 영향 평가', () => {
    const law = svc.register('전자정부법', '2024-01', 'egov');
    const changes = svc.detect(law.lawId, 'old text', 'new text with 의무');
    const alerts = svc.assess(law, changes);
    expect(Array.isArray(alerts)).toBe(true);
  });

  it('FR-N315.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
