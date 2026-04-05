// MFA TOTP 요청 검증 스키마
// Design Ref: DESIGN-MTU-P01 Section 2
// Plan SC: FR-P01.10
// CSAP: D-08-08 다중 인증

import { z } from 'zod';

/**
 * MFA 등록 요청 스키마
 */
export const mfaSetupSchema = z.object({
  /** 현재 비밀번호 (보안 확인) */
  password: z.string().min(1, '비밀번호를 입력하세요'),
});

export type MfaSetupRequest = z.infer<typeof mfaSetupSchema>;

/**
 * MFA 검증/활성화 요청 스키마
 */
export const mfaVerifySchema = z.object({
  /** TOTP 6자리 코드 */
  code: z
    .string()
    .length(6, 'MFA 코드는 6자리여야 합니다')
    .regex(/^\d+$/, 'MFA 코드는 숫자만 허용됩니다'),
  /** 등록 시 발급받은 임시 시크릿 */
  secret: z.string().min(1, '시크릿을 제공하세요'),
});

export type MfaVerifyRequest = z.infer<typeof mfaVerifySchema>;

/**
 * MFA 비활성화 요청 스키마
 */
export const mfaDisableSchema = z.object({
  /** 현재 비밀번호 (보안 확인) */
  password: z.string().min(1, '비밀번호를 입력하세요'),
  /** TOTP 6자리 코드 (현재 MFA 확인) */
  code: z
    .string()
    .length(6, 'MFA 코드는 6자리여야 합니다')
    .regex(/^\d+$/, 'MFA 코드는 숫자만 허용됩니다'),
});

export type MfaDisableRequest = z.infer<typeof mfaDisableSchema>;
