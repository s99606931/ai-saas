import { describe, it, expect } from 'vitest';
import { InteragencyDataExchangeAI } from '../interagency-data-exchange-ai.js';

describe('SVC-AI-ADV-R460 InteragencyDataExchangeAI', () => {
  const svc = new InteragencyDataExchangeAI();

  it('FR-460.3: string/number/date 변환', () => {
    const r = svc.exchange(
      { name: '홍길동', age: '30', birth: '1995-01-01' },
      [
        { sourceField: 'name', targetField: 'fullName', type: 'string' },
        { sourceField: 'age', targetField: 'ageYears', type: 'number' },
        { sourceField: 'birth', targetField: 'birthDate', type: 'date' },
      ],
    );
    expect(r.transformed['fullName']).toBe('홍길동');
    expect(r.transformed['ageYears']).toBe(30);
    expect(r.transformed['birthDate']).toBe('1995-01-01');
    expect(r.lostFields.length).toBe(0);
  });

  it('FR-460.4: 필드 누락', () => {
    const r = svc.exchange(
      { name: '홍길동' },
      [
        { sourceField: 'name', targetField: 'n', type: 'string' },
        { sourceField: 'age', targetField: 'a', type: 'number' },
      ],
    );
    expect(r.lostFields).toContain('age');
    expect(r.transformed['n']).toBe('홍길동');
  });

  it('FR-460.5: number NaN → 손실', () => {
    const r = svc.exchange(
      { age: 'abc' },
      [{ sourceField: 'age', targetField: 'a', type: 'number' }],
    );
    expect(r.lostFields).toContain('age');
    expect(r.transformed['a']).toBeUndefined();
  });

  it('FR-460.3: date 형식 불일치 → 손실', () => {
    const r = svc.exchange(
      { birth: '95/1/1' },
      [{ sourceField: 'birth', targetField: 'b', type: 'date' }],
    );
    expect(r.lostFields).toContain('birth');
  });

  it('매핑 필드 오류', () => {
    expect(() =>
      svc.exchange({}, [{ sourceField: '', targetField: 't', type: 'string' }]),
    ).toThrow('INVALID_MAPPING');
  });

  it('빈 매핑', () => {
    const r = svc.exchange({ a: 1 }, []);
    expect(Object.keys(r.transformed).length).toBe(0);
  });

  it('FR-460.6: C 차단', () => {
    expect(() => svc.exchange({}, [], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.exchange({}, []);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
