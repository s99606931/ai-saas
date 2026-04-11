// 인증 스키마 검증 단위 테스트 (실제 소스 import)
// Design Ref: DESIGN-MTU-P01 Section 2
// CSAP: D-12 시스템 개발 보안 — Zod 입력 검증

import { describe, it, expect } from 'vitest';
import { loginSchema, refreshSchema, logoutSchema } from '../../src/schemas/login.schema.js';
import { passwordChangeSchema } from '../../src/schemas/password.schema.js';
import { mfaSetupSchema, mfaVerifySchema, mfaDisableSchema } from '../../src/schemas/mfa.schema.js';

// -- loginSchema -- CSAP D-12 ─────────────────────────────────────────────

describe('loginSchema (CSAP D-12)', () => {
  const validLogin = {
    email: 'admin@gov.kr',
    password: 'MyP@ssw0rd!',
    tenantSlug: 'gov-agency',
  };

  it('유효한 로그인 요청을 허용한다', () => {
    expect(loginSchema.safeParse(validLogin).success).toBe(true);
  });

  it('MFA 코드 포함 요청을 허용한다', () => {
    expect(loginSchema.safeParse({ ...validLogin, mfaCode: '123456' }).success).toBe(true);
  });

  it('이메일 형식이 아니면 거부한다', () => {
    expect(loginSchema.safeParse({ ...validLogin, email: 'not-email' }).success).toBe(false);
  });

  it('이메일 255자 초과를 거부한다', () => {
    const longEmail = 'a'.repeat(250) + '@b.com';
    expect(loginSchema.safeParse({ ...validLogin, email: longEmail }).success).toBe(false);
  });

  it('빈 비밀번호를 거부한다', () => {
    expect(loginSchema.safeParse({ ...validLogin, password: '' }).success).toBe(false);
  });

  it('비밀번호 128자 초과를 거부한다 (자원 고갈 방지)', () => {
    expect(loginSchema.safeParse({ ...validLogin, password: 'a'.repeat(129) }).success).toBe(false);
  });

  it('빈 테넌트 슬러그를 거부한다', () => {
    expect(loginSchema.safeParse({ ...validLogin, tenantSlug: '' }).success).toBe(false);
  });

  it('테넌트 슬러그 100자 초과를 거부한다', () => {
    expect(loginSchema.safeParse({ ...validLogin, tenantSlug: 'a'.repeat(101) }).success).toBe(false);
  });

  it('MFA 코드가 6자리가 아니면 거부한다', () => {
    expect(loginSchema.safeParse({ ...validLogin, mfaCode: '12345' }).success).toBe(false);
    expect(loginSchema.safeParse({ ...validLogin, mfaCode: '1234567' }).success).toBe(false);
  });

  it('MFA 코드에 문자가 포함되면 거부한다', () => {
    expect(loginSchema.safeParse({ ...validLogin, mfaCode: 'abcdef' }).success).toBe(false);
  });

  it('MFA 코드는 선택적이다', () => {
    const result = loginSchema.safeParse(validLogin);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mfaCode).toBeUndefined();
    }
  });

  it('필수 필드 누락을 거부한다', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(false);
  });
});

// -- refreshSchema ────────────────────────────────────────────────────────

describe('refreshSchema', () => {
  it('유효한 갱신 토큰을 허용한다', () => {
    expect(refreshSchema.safeParse({ refreshToken: 'eyJ.test.sig' }).success).toBe(true);
  });

  it('빈 갱신 토큰을 거부한다', () => {
    expect(refreshSchema.safeParse({ refreshToken: '' }).success).toBe(false);
  });

  it('필드 누락을 거부한다', () => {
    expect(refreshSchema.safeParse({}).success).toBe(false);
  });
});

// -- logoutSchema ─────────────────────────────────────────────────────────

describe('logoutSchema', () => {
  it('유효한 토큰을 허용한다', () => {
    expect(logoutSchema.safeParse({ refreshToken: 'token123' }).success).toBe(true);
  });

  it('빈 토큰을 거부한다', () => {
    expect(logoutSchema.safeParse({ refreshToken: '' }).success).toBe(false);
  });
});

// -- passwordChangeSchema ─────────────────────────────────────────────────

describe('passwordChangeSchema (CSAP D-08-07)', () => {
  it('유효한 비밀번호 변경 요청을 허용한다', () => {
    expect(passwordChangeSchema.safeParse({
      currentPassword: 'OldP@ss1',
      newPassword: 'NewP@ss2!',
    }).success).toBe(true);
  });

  it('현재 비밀번호 누락을 거부한다', () => {
    expect(passwordChangeSchema.safeParse({
      newPassword: 'NewP@ss2!',
    }).success).toBe(false);
  });

  it('빈 현재 비밀번호를 거부한다', () => {
    expect(passwordChangeSchema.safeParse({
      currentPassword: '',
      newPassword: 'NewP@ss2!',
    }).success).toBe(false);
  });

  it('새 비밀번호 8자 미만을 거부한다', () => {
    expect(passwordChangeSchema.safeParse({
      currentPassword: 'old',
      newPassword: 'short',
    }).success).toBe(false);
  });

  it('새 비밀번호 128자 초과를 거부한다', () => {
    expect(passwordChangeSchema.safeParse({
      currentPassword: 'old',
      newPassword: 'a'.repeat(129),
    }).success).toBe(false);
  });

  it('새 비밀번호 누락을 거부한다', () => {
    expect(passwordChangeSchema.safeParse({
      currentPassword: 'OldP@ss1',
    }).success).toBe(false);
  });
});

// -- MFA 스키마 (실제 소스 import 검증) ─────────────────────────────────────

describe('mfaSetupSchema (실제 소스)', () => {
  it('유효한 비밀번호를 허용한다', () => {
    expect(mfaSetupSchema.safeParse({ password: 'test' }).success).toBe(true);
  });

  it('빈 비밀번호를 거부한다', () => {
    expect(mfaSetupSchema.safeParse({ password: '' }).success).toBe(false);
  });
});

describe('mfaVerifySchema (실제 소스)', () => {
  it('6자리 숫자를 허용한다', () => {
    expect(mfaVerifySchema.safeParse({ code: '000000' }).success).toBe(true);
    expect(mfaVerifySchema.safeParse({ code: '999999' }).success).toBe(true);
  });

  it('비숫자를 거부한다', () => {
    expect(mfaVerifySchema.safeParse({ code: 'abcdef' }).success).toBe(false);
  });
});

describe('mfaDisableSchema (실제 소스)', () => {
  it('비밀번호 + 코드를 허용한다', () => {
    expect(mfaDisableSchema.safeParse({ password: 'test', code: '123456' }).success).toBe(true);
  });

  it('코드 누락을 거부한다', () => {
    expect(mfaDisableSchema.safeParse({ password: 'test' }).success).toBe(false);
  });

  it('비밀번호 누락을 거부한다', () => {
    expect(mfaDisableSchema.safeParse({ code: '123456' }).success).toBe(false);
  });
});
