import { describe, it, expect, beforeEach } from 'vitest';
import { GovernmentPaperworkReducerAI } from '../government-paperwork-reducer-ai';

describe('GovernmentPaperworkReducerAI', () => {
  let ai: GovernmentPaperworkReducerAI;

  beforeEach(() => {
    ai = new GovernmentPaperworkReducerAI();
    ai.registerForm({
      formId: 'f1',
      name: '주민등록 등본 신청서',
      agency: '행안부',
      fields: ['이름', '주민번호', '주소', '연락처'],
      estimatedMinutes: 10,
    });
    ai.registerForm({
      formId: 'f2',
      name: '여권 신청서',
      agency: '외교부',
      fields: ['이름', '주민번호', '주소', '사진'],
      estimatedMinutes: 15,
    });
  });

  it('중복 필드를 감지한다', () => {
    const dup = ai.detectDuplicates();
    const names = dup.map(d => d.fieldName);
    expect(names).toContain('이름');
    expect(names).toContain('주민번호');
    expect(names).toContain('주소');
  });

  it('간소화 제안을 생성한다', () => {
    const s = ai.suggestSimplification('f1');
    expect(s.removableFields.length).toBeGreaterThan(0);
    expect(s.estimatedSavedMinutes).toBeGreaterThan(0);
  });

  it('기관별 총 소요 시간을 계산한다', () => {
    expect(ai.totalEstimatedMinutes('행안부')).toBe(10);
    expect(ai.totalEstimatedMinutes()).toBe(25);
  });

  it('기관별 서류 목록을 반환한다', () => {
    expect(ai.listForms('외교부').length).toBe(1);
  });

  it('빈 필드 서류는 거부한다', () => {
    expect(() =>
      ai.registerForm({ formId: 'x', name: 'x', agency: 'x', fields: [], estimatedMinutes: 1 }),
    ).toThrow('필드');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerForm(
        { formId: 'x', name: 'x', agency: 'x', fields: ['a'], estimatedMinutes: 1 },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
