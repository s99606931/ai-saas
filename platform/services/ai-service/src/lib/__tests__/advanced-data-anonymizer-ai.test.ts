import { describe, it, expect, beforeEach } from 'vitest';
import { AdvancedDataAnonymizerAI } from '../advanced-data-anonymizer-ai';

describe('AdvancedDataAnonymizerAI', () => {
  let anonymizer: AdvancedDataAnonymizerAI;

  beforeEach(() => {
    anonymizer = new AdvancedDataAnonymizerAI();
  });

  it('프로파일을 등록한다', () => {
    anonymizer.registerProfile('p1', '기본 마스킹', ['masking']);
    const logs = anonymizer.getAuditLog();
    expect(logs.some(l => l.action === 'REGISTER_PROFILE')).toBe(true);
  });

  it('이메일을 마스킹한다', () => {
    anonymizer.registerProfile('p1', '마스킹', ['masking']);
    const result = anonymizer.anonymize({ email: 'user@gov.kr', name: '홍길동' }, 'p1');
    expect(result.anonymized['email']).toBe('[EMAIL]');
  });

  it('전화번호를 마스킹한다', () => {
    anonymizer.registerProfile('p1', '마스킹', ['masking']);
    const result = anonymizer.anonymize({ phone: '010-1234-5678' }, 'p1');
    expect(result.anonymized['phone']).toBe('[PHONE]');
  });

  it('나이를 연령대로 일반화한다', () => {
    anonymizer.registerProfile('p1', '일반화', ['generalization']);
    const result = anonymizer.anonymize({ age: 35 }, 'p1');
    expect(result.anonymized['age']).toBe('30대');
  });

  it('suppression 기법으로 필드를 제거한다', () => {
    anonymizer.registerProfile('p1', '억제', ['suppression'], ['ssn']);
    const result = anonymizer.anonymize({ name: '김민수', ssn: '900101-1234567' }, 'p1');
    expect('ssn' in result.anonymized).toBe(false);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    anonymizer.registerProfile('p1', '테스트', ['masking']);
    expect(() => anonymizer.anonymize({ data: 'test' }, 'p1', 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 프로파일 사용 시 오류를 던진다', () => {
    expect(() => anonymizer.anonymize({ name: 'test' }, 'nonexistent')).toThrow('프로파일 미등록');
  });

  it('k-익명성을 검증한다 (k=2 통과)', () => {
    anonymizer.registerProfile('p1', '마스킹', ['generalization']);
    const dataset = [
      { age: '30대', region: '서울' },
      { age: '30대', region: '서울' },
      { age: '40대', region: '부산' },
      { age: '40대', region: '부산' },
    ];
    const valid = anonymizer.validateKAnonymity(dataset, ['age', 'region'], 2);
    expect(valid).toBe(true);
  });

  it('k-익명성 검증 실패 (k=3 미충족)', () => {
    anonymizer.registerProfile('p1', '마스킹', ['generalization']);
    const dataset = [
      { age: '30대', region: '서울' },
      { age: '30대', region: '서울' },
    ];
    const valid = anonymizer.validateKAnonymity(dataset, ['age', 'region'], 3);
    expect(valid).toBe(false);
  });
});
