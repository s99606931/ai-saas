// N2SF 데이터 등급 검증 테스트
// Design Ref: DESIGN-MTU-P10
// Plan SC: FR-P10.2
// CSAP: N2SF N-05 — C/S등급 AI API 전송 절대 금지

import { describe, it, expect } from 'vitest';
import {
  validateDataGrade,
  DataGradeViolationError,
  canSendToModel,
} from '../../src/lib/grade-check.js';

describe('validateDataGrade (N2SF N-05)', () => {
  it('O등급 데이터는 허용한다', () => {
    expect(() => validateDataGrade('O')).not.toThrow();
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() => validateDataGrade('S')).toThrow(DataGradeViolationError);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() => validateDataGrade('C')).toThrow(DataGradeViolationError);
  });

  it('C등급 차단 시 올바른 에러 코드를 포함한다', () => {
    try {
      validateDataGrade('C');
    } catch (e) {
      expect(e).toBeInstanceOf(DataGradeViolationError);
      if (e instanceof DataGradeViolationError) {
        expect(e.code).toBe('N2SF_DATA_GRADE_VIOLATION');
        expect(e.grade).toBe('C');
        expect(e.message).toContain('N2SF N-05');
      }
    }
  });

  it('S등급 차단 시 올바른 에러 메시지를 포함한다', () => {
    try {
      validateDataGrade('S');
    } catch (e) {
      if (e instanceof DataGradeViolationError) {
        expect(e.message).toContain('S등급');
        expect(e.message).toContain('금지');
      }
    }
  });
});

describe('canSendToModel', () => {
  it('O등급 모델에 O등급 데이터 전송 가능', () => {
    expect(canSendToModel('O', 'O')).toBe(true);
  });

  it('O등급 모델에 S등급 데이터 전송 불가', () => {
    expect(canSendToModel('O', 'S')).toBe(false);
  });

  it('O등급 모델에 C등급 데이터 전송 불가', () => {
    expect(canSendToModel('O', 'C')).toBe(false);
  });

  it('S등급 모델에 O등급 데이터 전송 가능', () => {
    expect(canSendToModel('S', 'O')).toBe(true);
  });

  it('S등급 모델에 S등급 데이터 전송 가능', () => {
    expect(canSendToModel('S', 'S')).toBe(true);
  });

  it('C등급 모델에 모든 등급 전송 가능', () => {
    expect(canSendToModel('C', 'O')).toBe(true);
    expect(canSendToModel('C', 'S')).toBe(true);
    expect(canSendToModel('C', 'C')).toBe(true);
  });
});
