// 비밀번호 변경 요청 검증 스키마
// Design Ref: SVC-AUTH-R1 DESIGN §2.4
// Plan SC: FR-AUTH.2
// CSAP: D-08-07 비밀번호 정책, D-12 입력 검증

import { z } from 'zod';

/**
 * 비밀번호 변경 요청 스키마
 *
 * CSAP D-12: 모든 사용자 입력에 대해 Zod 스키마 검증 필수
 */
export const passwordChangeSchema = z.object({
  /** 현재 비밀번호 */
  currentPassword: z.string().min(1, '현재 비밀번호를 입력하세요').max(128, '비밀번호는 128자 이하여야 합니다'),
  /** 새 비밀번호 */
  newPassword: z
    .string()
    .min(8, '새 비밀번호는 최소 8자 이상이어야 합니다')
    .max(128, '비밀번호는 128자 이하여야 합니다'),
});

export type PasswordChangeRequest = z.infer<typeof passwordChangeSchema>;
