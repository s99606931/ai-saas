import { describe, it, expect, beforeEach } from 'vitest';
import { CivilPetitionAutoResponder } from '../civil-petition-auto-responder';

describe('CivilPetitionAutoResponder', () => {
  let responder: CivilPetitionAutoResponder;

  beforeEach(() => {
    responder = new CivilPetitionAutoResponder();
  });

  it('주차 민원을 정확히 분류한다', () => {
    const result = responder.analyze({
      petitionId: 'p-1',
      text: '주차 단속이 너무 가혹합니다',
      submittedAt: '2026-04-13T00:00:00.000Z',
    });
    expect(result.category).toBe('parking');
  });

  it('긴급 키워드는 SLA 2시간이다', () => {
    const result = responder.analyze({
      petitionId: 'p-2',
      text: '긴급 사안입니다 즉시 조치 바랍니다',
      submittedAt: '2026-04-13T00:00:00.000Z',
    });
    expect(result.sentiment).toBe('urgent');
    expect(result.slaHours).toBe(2);
  });

  it('분노 감정 시 사과 문구가 포함된다', () => {
    const result = responder.analyze({
      petitionId: 'p-3',
      text: '쓰레기 수거가 너무 분노스럽습니다',
      submittedAt: '2026-04-13T00:00:00.000Z',
    });
    expect(result.autoReplyDraft).toContain('사과');
    expect(result.requiresHumanReview).toBe(true);
  });

  it('복지 민원은 사람 검토 필수이다', () => {
    const result = responder.analyze({
      petitionId: 'p-4',
      text: '기초생활 지원 신청 절차 문의',
      submittedAt: '2026-04-13T00:00:00.000Z',
    });
    expect(result.category).toBe('welfare');
    expect(result.requiresHumanReview).toBe(true);
  });

  it('알 수 없는 텍스트는 general로 분류한다', () => {
    const result = responder.analyze({
      petitionId: 'p-5',
      text: '안녕하세요 문의드립니다',
      submittedAt: '2026-04-13T00:00:00.000Z',
    });
    expect(result.category).toBe('general');
  });

  it('S등급 데이터는 차단된다', () => {
    expect(() =>
      responder.analyze(
        { petitionId: 'p', text: '문의', submittedAt: '2026-04-13T00:00:00.000Z' },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
