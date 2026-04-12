// data-mask 테스트
// Plan SC: FR-DM.1~FR-DM.10

import { describe, it, expect, vi } from 'vitest';
import {
  maskString,
  maskTree,
  enforceGrade,
  enforceAiSafe,
  isLuhnValid,
  DataGradeViolationError,
  type MaskPolicy,
} from '../src/index.js';

describe('FR-DM.1: 주민등록번호', () => {
  it('하이픈 포함 패턴', () => {
    expect(maskString('주민번호: 901231-1234567')).toBe(
      '주민번호: 901231-1******',
    );
  });

  it('하이픈 없는 패턴', () => {
    expect(maskString('9012311234567')).toBe('901231-1******');
  });

  it('공백 구분 패턴', () => {
    expect(maskString('901231 1234567')).toBe('901231-1******');
  });

  it('잘못된 포맷은 그대로', () => {
    expect(maskString('901231-9999999')).toBe('901231-9999999');
  });
});

describe('FR-DM.2: 휴대폰 / 유선', () => {
  it('010 휴대폰', () => {
    expect(maskString('010-1234-5678')).toBe('010-****-5678');
  });

  it('011 휴대폰', () => {
    expect(maskString('011-123-4567')).toBe('011-****-4567');
  });

  it('02 유선', () => {
    expect(maskString('02-1234-5678')).toBe('02-****-5678');
  });
});

describe('FR-DM.3: 이메일', () => {
  it('짧은 로컬파트', () => {
    expect(maskString('a@example.com')).toBe('a***@example.com');
  });

  it('긴 로컬파트', () => {
    expect(maskString('alice@example.co.kr')).toBe('a***@example.co.kr');
  });
});

describe('FR-DM.4: 신용카드 (Luhn)', () => {
  it('Luhn 통과 카드 → 마스킹', () => {
    // Visa 테스트 카드: 4242 4242 4242 4242 (Luhn pass)
    expect(maskString('4242-4242-4242-4242')).toBe('4242-42**-****-4242');
  });

  it('Luhn 실패 → 그대로', () => {
    expect(maskString('1234-5678-9012-3456')).toBe('1234-5678-9012-3456');
  });

  it('isLuhnValid 검증', () => {
    expect(isLuhnValid('4242424242424242')).toBe(true);
    expect(isLuhnValid('1234567890123456')).toBe(false);
  });
});

describe('FR-DM.5: 계좌번호', () => {
  it('한국 은행 계좌 패턴', () => {
    expect(maskString('110-456-789012')).toBe('***-***-9012');
  });
});

describe('FR-DM.6: 주소', () => {
  it('서울 강남구', () => {
    expect(maskString('서울특별시 강남구 테헤란로 123')).toBe(
      '서울특별시 강남구 ****',
    );
  });

  it('경기 수원시', () => {
    expect(maskString('경기도 수원시 영통구 매탄동')).toContain(
      '경기도 수원시',
    );
  });
});

describe('FR-DM.7: 트리 마스킹', () => {
  it('1단계 객체', () => {
    const out = maskTree({ phone: '010-1234-5678' });
    expect(out.phone).toBe('010-****-5678');
  });

  it('3단계 깊이', () => {
    const out = maskTree({
      a: { b: { c: 'email: test@x.com' } },
    });
    expect(out.a.b.c).toBe('email: t***@x.com');
  });

  it('5단계 깊이', () => {
    const out = maskTree({
      a: { b: { c: { d: { e: '901231-1234567' } } } },
    });
    expect(out.a.b.c.d.e).toBe('901231-1******');
  });

  it('배열 마스킹', () => {
    const out = maskTree(['a@x.com', 'b@y.com', 42]);
    expect(out).toEqual(['a***@x.com', 'b***@y.com', 42]);
  });

  it('null/undefined 안전', () => {
    expect(maskTree(null)).toBeNull();
    expect(maskTree(undefined)).toBeUndefined();
  });

  it('순환 참조 차단', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const out = maskTree(obj) as Record<string, unknown>;
    expect(out.self).toBe('[CIRCULAR]');
  });
});

describe('FR-DM.8: 키 정책', () => {
  it('password 키는 [MASKED]', () => {
    const out = maskTree({ password: 'super-secret' });
    expect(out.password).toBe('[MASKED]');
  });

  it('ssn 키는 [MASKED]', () => {
    const out = maskTree({ ssn: 'whatever' });
    expect(out.ssn).toBe('[MASKED]');
  });

  it('커스텀 정책 키 패턴', () => {
    const policy: MaskPolicy = {
      maskedKeyPatterns: [/^internal_/i],
    };
    const out = maskTree({ internal_id: 'X', name: 'Y' }, policy);
    expect(out.internal_id).toBe('[MASKED]');
    expect(out.name).toBe('Y');
  });
});

describe('FR-DM.9: enforceGrade', () => {
  it('C 등급은 차단', () => {
    expect(() => enforceGrade('C', ['O'])).toThrow(
      DataGradeViolationError,
    );
  });

  it('S 등급은 차단', () => {
    expect(() => enforceAiSafe('S')).toThrow(DataGradeViolationError);
  });

  it('O 등급은 통과', () => {
    expect(() => enforceAiSafe('O')).not.toThrow();
  });

  it('에러 객체에 grade와 allowed 포함', () => {
    try {
      enforceGrade('C', ['O', 'S']);
    } catch (err) {
      expect(err).toBeInstanceOf(DataGradeViolationError);
      const e = err as DataGradeViolationError;
      expect(e.grade).toBe('C');
      expect(e.allowed).toEqual(['O', 'S']);
    }
  });
});

describe('FR-DM.10: 감사 훅', () => {
  it('onMask 콜백 호출 횟수', () => {
    const onMask = vi.fn();
    maskString('010-1234-5678 / a@b.com / 901231-1234567', { onMask });
    expect(onMask).toHaveBeenCalled();
    const types = onMask.mock.calls.map((c) => c[0].type);
    expect(types).toContain('phone');
    expect(types).toContain('email');
    expect(types).toContain('ssn');
  });

  it('onMask 예외는 격리', () => {
    const policy: MaskPolicy = {
      onMask: () => {
        throw new Error('hook fail');
      },
    };
    expect(() => maskString('010-1234-5678', policy)).not.toThrow();
  });
});

describe('정확도', () => {
  it('일반 한글 텍스트는 변경 없음', () => {
    expect(maskString('안녕하세요 반갑습니다')).toBe('안녕하세요 반갑습니다');
  });

  it('복합 텍스트 (이메일+전화)', () => {
    const out = maskString('연락처: alice@x.com 또는 010-1234-5678');
    expect(out).toContain('a***@x.com');
    expect(out).toContain('010-****-5678');
  });

  it('빈 문자열', () => {
    expect(maskString('')).toBe('');
  });
});
