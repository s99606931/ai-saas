import { describe, it, expect, beforeEach } from 'vitest';
import { CitizenFeedbackLoopAIV3 } from '../citizen-feedback-loop-ai-v3';

describe('CitizenFeedbackLoopAIV3', () => {
  let loop: CitizenFeedbackLoopAIV3;

  beforeEach(() => {
    loop = new CitizenFeedbackLoopAIV3();
    loop.registerChannel({ channelId: 'ch1', name: 'web', weight: 1.0 });
  });

  it('classifies URGENT + ESCALATE for score >= 0.8', () => {
    const v = loop.submitFeedback({
      feedbackId: 'f1',
      channelId: 'ch1',
      citizenId: '900101-1234567',
      sentimentNegativity: 0.9,
      attachmentImpact: 'low',
    });
    expect(v.priority).toBe('URGENT');
    expect(v.action).toBe('ESCALATE');
    expect(v.maskedCitizenId).toHaveLength(16);
    expect(v.maskedCitizenId).not.toContain('900101');
  });

  it('classifies HIGH + REVIEW for score 0.5~0.8', () => {
    const v = loop.submitFeedback({
      feedbackId: 'f1',
      channelId: 'ch1',
      citizenId: 'c-x',
      sentimentNegativity: 0.6,
      attachmentImpact: 'low',
    });
    expect(v.priority).toBe('HIGH');
    expect(v.action).toBe('REVIEW');
  });

  it('classifies NORMAL + QUEUE for score < 0.5', () => {
    const v = loop.submitFeedback({
      feedbackId: 'f1',
      channelId: 'ch1',
      citizenId: 'c-x',
      sentimentNegativity: 0.2,
      attachmentImpact: 'low',
    });
    expect(v.priority).toBe('NORMAL');
    expect(v.action).toBe('QUEUE');
  });

  it('escalates one rank when attachmentImpact high', () => {
    const v = loop.submitFeedback({
      feedbackId: 'f1',
      channelId: 'ch1',
      citizenId: 'c-x',
      sentimentNegativity: 0.2,
      attachmentImpact: 'high',
    });
    expect(v.action).toBe('REVIEW');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      loop.submitFeedback(
        {
          feedbackId: 'f',
          channelId: 'ch1',
          citizenId: 'c',
          sentimentNegativity: 0.5,
          attachmentImpact: 'low',
        },
        'C',
      ),
    ).toThrow('BLOCKED');
    expect(() =>
      loop.submitFeedback(
        {
          feedbackId: 'f',
          channelId: 'ch1',
          citizenId: 'c',
          sentimentNegativity: 0.5,
          attachmentImpact: 'low',
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown channel, invalid sentiment and invalid weight', () => {
    expect(() =>
      loop.submitFeedback({
        feedbackId: 'f',
        channelId: 'unknown',
        citizenId: 'c',
        sentimentNegativity: 0.5,
        attachmentImpact: 'low',
      }),
    ).toThrow('UNKNOWN_CHANNEL');
    expect(() =>
      loop.submitFeedback({
        feedbackId: 'f',
        channelId: 'ch1',
        citizenId: 'c',
        sentimentNegativity: 2,
        attachmentImpact: 'low',
      }),
    ).toThrow('INVALID_SENTIMENT');
    expect(() => loop.registerChannel({ channelId: 'x', name: 'x', weight: 0 })).toThrow(
      'INVALID_WEIGHT',
    );
  });

  it('lists escalations and audit log uses masked id', () => {
    loop.submitFeedback({
      feedbackId: 'f1',
      channelId: 'ch1',
      citizenId: '900101-1234567',
      sentimentNegativity: 0.95,
      attachmentImpact: 'low',
    });
    loop.submitFeedback({
      feedbackId: 'f2',
      channelId: 'ch1',
      citizenId: 'c2',
      sentimentNegativity: 0.1,
      attachmentImpact: 'low',
    });
    expect(loop.getEscalations().map((v) => v.feedbackId)).toEqual(['f1']);
    const auditEntries = loop.getAuditLog();
    expect(auditEntries.some((e) => e.action === 'SUBMIT_FEEDBACK')).toBe(true);
    const submitEntries = auditEntries.filter((e) => e.action === 'SUBMIT_FEEDBACK');
    for (const entry of submitEntries) {
      const detailsStr = JSON.stringify(entry.details ?? {});
      expect(detailsStr).not.toContain('900101');
    }
  });
});
