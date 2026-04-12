import { describe, it, expect, beforeEach } from 'vitest';
import { PermitFlowAi } from '../permit-flow-ai.js';

describe('PermitFlowAi', () => {
  let flow: PermitFlowAi;

  beforeEach(() => {
    flow = new PermitFlowAi();
    flow.registerType({
      code: 'BIZ-01',
      name: '영업신고',
      slaBusinessDays: 5,
      requirements: [
        { code: 'id_copy', description: '신분증 사본', mandatory: true },
        { code: 'biz_plan', description: '사업계획서', mandatory: true },
      ],
      disqualifiers: ['파산', '금고이상형'],
    });
  });

  it('문서 누락 탐지', () => {
    flow.submit('app-1', 'BIZ-01', 'user-1', { id_copy: 'base64...' });
    const r = flow.validate('app-1', '정상 신청');
    expect(r.valid).toBe(false);
    expect(r.missingDocs).toContain('biz_plan');
  });

  it('결격사유 탐지', () => {
    flow.submit('app-2', 'BIZ-01', 'user-1', { id_copy: 'a', biz_plan: 'b' });
    const r = flow.validate('app-2', '신청인이 파산 상태');
    expect(r.disqualifiersHit).toContain('파산');
  });

  it('단계 역방향 전환 거부', () => {
    flow.submit('app-3', 'BIZ-01', 'user-1', { id_copy: 'a', biz_plan: 'b' });
    flow.advance('app-3', 'legal_review');
    expect(() => flow.advance('app-3', 'submitted')).toThrow('PERMIT_INVALID_STAGE_TRANSITION');
  });

  it('반려는 언제든 가능', () => {
    flow.submit('app-4', 'BIZ-01', 'user-1', { id_copy: 'a' });
    const r = flow.reject('app-4', ['서류 미비']);
    expect(r.stage).toBe('rejected');
  });

  it('SLA 초과 탐지', () => {
    flow.submit('app-5', 'BIZ-01', 'user-1', { id_copy: 'a', biz_plan: 'b' });
    const future = new Date(Date.now() + 10 * 86400000);
    const s = flow.checkSlaStatus('app-5', future);
    expect(s.overdue).toBe(true);
  });

  it('반려 사유 필수', () => {
    flow.submit('app-6', 'BIZ-01', 'user-1', {});
    expect(() => flow.reject('app-6', [])).toThrow('PERMIT_REJECT_REASONS_REQUIRED');
  });
});
