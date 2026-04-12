/**
 * RPA + IDP + Email + Meeting 테스트
 */

import {
  RpaProcessBuilder,
  RpaAuditLog,
  IdpExtractor,
  ReviewQueue,
  EmailClassifier,
  MeetingOptimizer,
} from '../src/index';

describe('RpaProcessBuilder', () => {
  it('build: 정상 빌드', () => {
    const p = new RpaProcessBuilder('p1', '민원처리', 'start')
      .addStep({
        stepId: 'start',
        action: 'click',
        parameters: { selector: '#submit' },
      })
      .build();
    expect(p.processId).toBe('p1');
    expect(p.steps.length).toBe(1);
  });

  it('build: entryStep이 steps에 없으면 오류', () => {
    expect(() =>
      new RpaProcessBuilder('p1', '', 'missing')
        .addStep({ stepId: 'other', action: 'click', parameters: {} })
        .build(),
    ).toThrow(/entryStep/);
  });
});

describe('RpaAuditLog', () => {
  it('log + history', () => {
    const l = new RpaAuditLog();
    l.log('e1', 's1', 'success');
    l.log('e1', 's2', 'success');
    l.log('e2', 's1', 'failed');
    expect(l.history('e1').length).toBe(2);
  });
});

describe('IdpExtractor', () => {
  const e = new IdpExtractor();

  it('필수 필드 모두 있음 + 신뢰도 높음 → review 불필요', () => {
    const doc = e.process(
      'd1',
      '주민등록증',
      [
        { fieldName: 'name', value: '홍길동', confidence: 0.95, page: 1 },
        { fieldName: 'rrn', value: '900101-*', confidence: 0.9, page: 1 },
      ],
      ['name', 'rrn'],
    );
    expect(doc.needsReview).toBe(false);
    expect(doc.overallConfidence).toBeGreaterThan(0.85);
  });

  it('필수 필드 누락 → review 필요', () => {
    const doc = e.process(
      'd1',
      '신분증',
      [{ fieldName: 'name', value: '홍', confidence: 0.95, page: 1 }],
      ['name', 'rrn'],
    );
    expect(doc.needsReview).toBe(true);
  });

  it('신뢰도 낮음 → review 필요', () => {
    const doc = e.process(
      'd1',
      '신분증',
      [{ fieldName: 'name', value: '?', confidence: 0.7, page: 1 }],
      ['name'],
    );
    expect(doc.needsReview).toBe(true);
  });
});

describe('ReviewQueue', () => {
  it('needsReview true만 enqueue', () => {
    const q = new ReviewQueue();
    q.enqueue({
      documentId: 'd1',
      type: 't',
      fields: [],
      overallConfidence: 0.5,
      needsReview: true,
    });
    q.enqueue({
      documentId: 'd2',
      type: 't',
      fields: [],
      overallConfidence: 0.95,
      needsReview: false,
    });
    expect(q.pending().length).toBe(1);
  });
});

describe('EmailClassifier', () => {
  const c = new EmailClassifier();

  it('민원 분류 + 우선순위 9', () => {
    const r = c.classify({ subject: '민원', body: '불만 접수합니다', sender: 'a@b.c' });
    expect(r.category).toBe('complaint');
    expect(r.priority).toBe(9);
    expect(r.suggestedTemplate).toBeDefined();
  });

  it('문의 분류', () => {
    expect(
      c.classify({ subject: '문의 드립니다', body: '', sender: 'x' }).category,
    ).toBe('inquiry');
  });

  it('광고 분류', () => {
    expect(
      c.classify({ subject: '50% 할인', body: '', sender: 'x' }).category,
    ).toBe('promotion');
  });

  it('스팸 분류', () => {
    expect(
      c.classify({ subject: '당첨!', body: '상금 받아가세요', sender: 'x' }).category,
    ).toBe('spam');
  });

  it('기타 분류', () => {
    expect(c.classify({ subject: '안녕', body: '', sender: 'x' }).category).toBe('other');
  });
});

describe('MeetingOptimizer', () => {
  const m = new MeetingOptimizer();

  it('빈 참여자 → null', () => {
    expect(m.findBestSlot([], 30)).toBeNull();
  });

  it('가능 슬롯 + 우선순위 가중치', () => {
    const r = m.findBestSlot(
      [
        {
          participantId: 'p1',
          priority: 10,
          availableSlots: [{ start: '2026-04-12T10:00:00Z', end: '2026-04-12T11:00:00Z' }],
        },
        {
          participantId: 'p2',
          priority: 5,
          availableSlots: [{ start: '2026-04-12T10:00:00Z', end: '2026-04-12T11:00:00Z' }],
        },
      ],
      30,
    );
    expect(r).not.toBeNull();
    expect(r?.score).toBe(15);
  });

  it('지속 시간 부족 슬롯 제외', () => {
    const r = m.findBestSlot(
      [
        {
          participantId: 'p1',
          priority: 1,
          availableSlots: [{ start: '2026-04-12T10:00:00Z', end: '2026-04-12T10:10:00Z' }],
        },
      ],
      30,
    );
    expect(r).toBeNull();
  });
});
