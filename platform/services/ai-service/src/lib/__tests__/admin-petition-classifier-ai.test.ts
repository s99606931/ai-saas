import { describe, it, expect, beforeEach } from 'vitest';
import { AdminPetitionClassifierAI } from '../admin-petition-classifier-ai';

describe('AdminPetitionClassifierAI', () => {
  let ai: AdminPetitionClassifierAI;

  beforeEach(() => {
    ai = new AdminPetitionClassifierAI();
    ai.registerDepartment({
      departmentId: 'env',
      name: '환경부서',
      keywords: ['쓰레기', '소음', '악취'],
      urgencyKeywords: ['긴급', '즉시'],
    });
    ai.registerDepartment({
      departmentId: 'road',
      name: '도로부서',
      keywords: ['도로', '포트홀', '신호등'],
      urgencyKeywords: ['사고', '위험'],
    });
  });

  it('부서를 등록한다', () => {
    expect(ai.listDepartments().length).toBe(2);
  });

  it('민원을 제출한다 (PII 마스킹)', () => {
    ai.submitPetition({
      petitionId: 'p1',
      title: '도로 파손',
      content: '연락처 010-1234-5678 로 연락 바랍니다',
      receivedAt: '2026-04-13T10:00:00Z',
    });
    const stored = ai.getPetition('p1');
    expect(stored?.content).toContain('[PHONE_MASKED]');
  });

  it('민원을 올바른 부서로 분류한다', () => {
    ai.submitPetition({
      petitionId: 'p1',
      title: '포트홀 때문에 위험합니다',
      content: '신호등도 고장 나서 사고 위험이 큽니다',
      receivedAt: 'now',
    });
    const result = ai.classify('p1');
    expect(result.primaryDepartment).toBe('road');
    expect(result.urgency).toBe('urgent');
  });

  it('키워드 없는 민원은 UNCLASSIFIED로 반환한다', () => {
    ai.submitPetition({
      petitionId: 'p1',
      title: '문의 드립니다',
      content: '일반 문의입니다',
      receivedAt: 'now',
    });
    const result = ai.classify('p1');
    expect(result.primaryDepartment).toBe('UNCLASSIFIED');
    expect(result.confidence).toBe(0);
  });

  it('미등록 민원 분류는 거부한다', () => {
    expect(() => ai.classify('unknown')).toThrow('민원 미등록');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerDepartment(
        {
          departmentId: 'x',
          name: 'X',
          keywords: ['a'],
          urgencyKeywords: [],
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
