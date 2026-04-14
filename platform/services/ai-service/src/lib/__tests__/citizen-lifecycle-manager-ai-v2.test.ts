import { describe, it, expect, beforeEach } from 'vitest';
import { CitizenLifecycleManagerAIV2 } from '../citizen-lifecycle-manager-ai-v2';

describe('CitizenLifecycleManagerAIV2', () => {
  let svc: CitizenLifecycleManagerAIV2;

  beforeEach(() => {
    svc = new CitizenLifecycleManagerAIV2();
  });

  it('FR-R688.2/3: NEW → ONBOARD', () => {
    const v = svc.updateContact({ citizenId: '900101-1234567', contacts: 0, satisfaction: 0.5 });
    expect(v.stage).toBe('NEW');
    expect(v.action).toBe('ONBOARD');
    expect(v.maskedCitizenId).toHaveLength(16);
    expect(v.maskedCitizenId).not.toContain('900101');
  });

  it('ACTIVE → NURTURE', () => {
    const v = svc.updateContact({ citizenId: 'c', contacts: 2, satisfaction: 0.6 });
    expect(v.stage).toBe('ACTIVE');
    expect(v.action).toBe('NURTURE');
  });

  it('LOYAL → REWARD', () => {
    const v = svc.updateContact({ citizenId: 'c', contacts: 5, satisfaction: 0.8 });
    expect(v.stage).toBe('LOYAL');
    expect(v.action).toBe('REWARD');
  });

  it('AT_RISK → INTERVENE (low satisfaction dominant)', () => {
    const v = svc.updateContact({ citizenId: 'c', contacts: 5, satisfaction: 0.2 });
    expect(v.stage).toBe('AT_RISK');
    expect(v.action).toBe('INTERVENE');
  });

  it('FR-R688.1: C/S blocked and invalid inputs rejected', () => {
    expect(() =>
      svc.updateContact({ citizenId: 'c', contacts: 0, satisfaction: 0.5 }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      svc.updateContact({ citizenId: 'c', contacts: -1, satisfaction: 0.5 }),
    ).toThrow('INVALID_CONTACTS');
    expect(() =>
      svc.updateContact({ citizenId: 'c', contacts: 1, satisfaction: 2 }),
    ).toThrow('INVALID_SATISFACTION');
  });

  it('FR-R688.4/5: getStage + audit masks citizenId', () => {
    const v = svc.updateContact({
      citizenId: '900101-9999999',
      contacts: 3,
      satisfaction: 0.8,
    });
    expect(svc.getStage(v.maskedCitizenId)).toBe('LOYAL');
    const audit = svc.getAuditLog();
    for (const e of audit) {
      expect(JSON.stringify(e.details ?? {})).not.toContain('900101');
    }
  });
});
