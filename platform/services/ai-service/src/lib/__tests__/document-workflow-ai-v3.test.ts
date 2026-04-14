import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentWorkflowAIV3 } from '../document-workflow-ai-v3';

describe('DocumentWorkflowAIV3', () => {
  let wf: DocumentWorkflowAIV3;

  beforeEach(() => {
    wf = new DocumentWorkflowAIV3();
    wf.registerTemplate({ templateId: 'tpl1', steps: ['draft', 'review', 'approve', 'sign'] });
  });

  it('ACTIVE for in-progress document', () => {
    const v = wf.draftDocument({
      docId: 'd1',
      templateId: 'tpl1',
      drafterId: '900101-1',
      completedSteps: 2,
      pendingDays: 1,
    });
    expect(v.progress).toBe(50);
    expect(v.status).toBe('ACTIVE');
    expect(v.maskedDrafterId).toHaveLength(16);
    expect(v.maskedDrafterId).not.toContain('900101');
  });

  it('STALLED when pending > 7 days', () => {
    const v = wf.draftDocument({
      docId: 'd1',
      templateId: 'tpl1',
      drafterId: 'd',
      completedSteps: 1,
      pendingDays: 10,
    });
    expect(v.status).toBe('STALLED');
  });

  it('DONE when all steps complete', () => {
    const v = wf.draftDocument({
      docId: 'd1',
      templateId: 'tpl1',
      drafterId: 'd',
      completedSteps: 4,
      pendingDays: 0,
    });
    expect(v.status).toBe('DONE');
    expect(v.progress).toBe(100);
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    const doc = {
      docId: 'd1',
      templateId: 'tpl1',
      drafterId: 'd',
      completedSteps: 1,
      pendingDays: 1,
    };
    expect(() => wf.draftDocument(doc, 'C')).toThrow('BLOCKED');
    expect(() => wf.draftDocument(doc, 'S')).toThrow('BLOCKED');
  });

  it('rejects unknown template, empty steps, invalid counts', () => {
    expect(() =>
      wf.draftDocument({
        docId: 'd',
        templateId: 'missing',
        drafterId: 'd',
        completedSteps: 0,
        pendingDays: 0,
      }),
    ).toThrow('UNKNOWN_TEMPLATE');
    expect(() => wf.registerTemplate({ templateId: 'x', steps: [] })).toThrow('EMPTY_STEPS');
    expect(() =>
      wf.draftDocument({
        docId: 'd',
        templateId: 'tpl1',
        drafterId: 'd',
        completedSteps: 9,
        pendingDays: 0,
      }),
    ).toThrow('INVALID_COMPLETED_STEPS');
  });

  it('audit log masks drafter id', () => {
    wf.draftDocument({
      docId: 'd1',
      templateId: 'tpl1',
      drafterId: '900101-1234567',
      completedSteps: 1,
      pendingDays: 1,
    });
    const log = wf.getAuditLog();
    expect(log.some((e) => e.action === 'DRAFT_DOCUMENT')).toBe(true);
    for (const entry of log) {
      expect(JSON.stringify(entry.details ?? {})).not.toContain('900101');
    }
  });
});
