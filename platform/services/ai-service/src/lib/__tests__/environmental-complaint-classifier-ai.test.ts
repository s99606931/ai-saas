import { describe, it, expect } from 'vitest';
import { EnvironmentalComplaintClassifierAI } from '../environmental-complaint-classifier-ai.js';

describe('SVC-AI-ADV-R436 EnvironmentalComplaintClassifierAI', () => {
  const svc = new EnvironmentalComplaintClassifierAI();

  it('FR-436.1: NOISE 분류', () => {
    const r = svc.classify([
      { id: '1', text: '밤새 공사 소음이 심합니다', region: '서울시 강남구' },
    ]);
    expect(r[0]!.type).toBe('NOISE');
    expect(r[0]!.confidence).toBeGreaterThan(0);
  });

  it('FR-436.1: WATER 분류', () => {
    const r = svc.classify([
      { id: '1', text: '하천에 오폐수가 흘러나옵니다', region: '부산' },
    ]);
    expect(r[0]!.type).toBe('WATER');
  });

  it('FR-436.2: HIGH 긴급도', () => {
    const r = svc.classify([
      { id: '1', text: '유해 물질 중독 의심', region: '경기' },
    ]);
    expect(r[0]!.urgency).toBe('HIGH');
  });

  it('FR-436.3: 수도권 배정', () => {
    const r = svc.classify([
      { id: '1', text: '먼지가 심합니다', region: '서울시 종로구' },
    ]);
    expect(r[0]!.agency).toBe('수도권지방환경청');
  });

  it('FR-436.3: 미매핑 지역 → 기타', () => {
    const r = svc.classify([
      { id: '1', text: '쓰레기 투기', region: '제주' },
    ]);
    expect(r[0]!.agency).toBe('기타지방환경청');
    expect(r[0]!.type).toBe('WASTE');
  });

  it('키워드 없음 → OTHER', () => {
    const r = svc.classify([{ id: '1', text: '일반 문의입니다', region: '서울' }]);
    expect(r[0]!.type).toBe('OTHER');
    expect(r[0]!.confidence).toBe(0);
  });

  it('FR-436.5: S 차단', () => {
    expect(() => svc.classify([], 'S')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.classify([{ id: '1', text: '소음', region: '서울' }]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
