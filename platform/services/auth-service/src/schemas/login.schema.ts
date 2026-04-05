// 로그인 요청 검증 스키마
// Design Ref: DESIGN-MTU-P01 Section 2
// CSAP: D-12 시스템 개발 보안 — 모든 입력 Zod 검증

import { z } from 'zod';

/**
 * 로그인 요청 스키마
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('유효한 이메일 주소를 입력하세요')
    .max(255, '이메일은 255자 이하여야 합니다'),
  password: z
    .string()
    .min(1, '비밀번호를 입력하세요')
    .max(128, '비밀번호는 128자 이하여야 합니다'),
  tenantSlug: z
    .string()
    .min(1, '테넌트를 선택하세요')
    .max(100),
  mfaCode: z
    .string()
    .length(6, 'MFA 코드는 6자리여야 합니다')
    .regex(/^\d+$/, 'MFA 코드는 숫자만 허용됩니다')
    .optional(),
});

export type LoginRequest = z.infer<typeof loginSchema>;

/**
 * 토큰 갱신 요청 스키마
 */
export const refreshSchema = z.object({
  refreshToken: z
    .string()
    .min(1, '갱신 토큰을 제공하세요'),
});

export type RefreshRequest = z.infer<typeof refreshSchema>;

/**
 * 로그아웃 요청 스키마
 */
export const logoutSchema = z.object({
  refreshToken: z
    .string()
    .min(1, '갱신 토큰을 제공하세요'),
});

export type LogoutRequest = z.infer<typeof logoutSchema>;
