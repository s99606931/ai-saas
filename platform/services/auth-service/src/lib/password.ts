// 비밀번호 해시/검증
// Design Ref: DESIGN-MTU-P01 Section 3
// Plan SC: FR-P01.9
// CSAP: D-08-07 비밀번호 정책

import bcrypt from 'bcrypt';
import { AUTH_CONSTANTS } from '@public-saas/auth-sdk';

/**
 * 비밀번호 해시 생성 (bcrypt cost=12)
 * CSAP D-08-07: 비밀번호 암호화 저장 필수
 *
 * @param password - 평문 비밀번호
 * @returns bcrypt 해시
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);
}

/**
 * 비밀번호 검증
 *
 * @param password - 평문 비밀번호
 * @param hash - bcrypt 해시
 * @returns 일치 여부
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 비밀번호 정책 검증
 * CSAP D-08-07: 대소문자+숫자+특수문자, 8자 이상
 *
 * @param password - 검증할 비밀번호
 * @returns 정책 위반 시 오류 메시지, 통과 시 null
 */
export function validatePasswordPolicy(password: string): string | null {
  if (password.length < AUTH_CONSTANTS.PASSWORD_MIN_LENGTH) {
    return `비밀번호는 최소 ${AUTH_CONSTANTS.PASSWORD_MIN_LENGTH}자 이상이어야 합니다`;
  }

  if (!AUTH_CONSTANTS.PASSWORD_REGEX.test(password)) {
    return '비밀번호는 대문자, 소문자, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다';
  }

  return null;
}
