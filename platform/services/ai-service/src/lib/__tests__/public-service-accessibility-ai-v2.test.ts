import { describe, it, expect, beforeEach } from 'vitest';
import { PublicServiceAccessibilityAIV2 } from '../public-service-accessibility-ai-v2';

describe('PublicServiceAccessibilityAIV2', () => {
  let svc: PublicServiceAccessibilityAIV2;

  beforeEach(() => {
    svc = new PublicServiceAccessibilityAIV2();
    svc.registerPage({ pageId: 'p1', url: 'https://gov.kr/p1', wcagLevel: 'AA' });
  });

  it('classifies CRITICAL + BLOCK_RELEASE for >=3 violations', () => {
    const r = svc.reportIssue({ issueId: 'i1', pageId: 'p1', wcagViolations: 4 });
    expect(r.severity).toBe('CRITICAL');
    expect(r.action).toBe('BLOCK_RELEASE');
  });

  it('classifies MAJOR + FIX_NOW for 2 violations', () => {
    const r = svc.reportIssue({ issueId: 'i1', pageId: 'p1', wcagViolations: 2 });
    expect(r.severity).toBe('MAJOR');
    expect(r.action).toBe('FIX_NOW');
  });

  it('classifies MINOR + BACKLOG for 1 violation', () => {
    const r = svc.reportIssue({ issueId: 'i1', pageId: 'p1', wcagViolations: 1 });
    expect(r.severity).toBe('MINOR');
    expect(r.action).toBe('BACKLOG');
  });

  it('escalates one rank when wcagLevel A', () => {
    svc.registerPage({ pageId: 'p2', url: 'https://gov.kr/p2', wcagLevel: 'A' });
    const r = svc.reportIssue({ issueId: 'i1', pageId: 'p2', wcagViolations: 1 });
    expect(r.action).toBe('FIX_NOW');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      svc.reportIssue({ issueId: 'i', pageId: 'p1', wcagViolations: 1 }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      svc.reportIssue({ issueId: 'i', pageId: 'p1', wcagViolations: 1 }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown page and invalid violations', () => {
    expect(() =>
      svc.reportIssue({ issueId: 'i', pageId: 'unknown', wcagViolations: 1 }),
    ).toThrow('UNKNOWN_PAGE');
    expect(() =>
      svc.reportIssue({ issueId: 'i', pageId: 'p1', wcagViolations: -1 }),
    ).toThrow('INVALID_VIOLATIONS');
  });

  it('lists blocking reports and maintains audit log', () => {
    svc.reportIssue({ issueId: 'i1', pageId: 'p1', wcagViolations: 5 });
    svc.reportIssue({ issueId: 'i2', pageId: 'p1', wcagViolations: 1 });
    expect(svc.getBlockingReports().map((r) => r.issueId)).toEqual(['i1']);
    expect(svc.getAuditLog().some((e) => e.action === 'REPORT_ISSUE')).toBe(true);
  });
});
