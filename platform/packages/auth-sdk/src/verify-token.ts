// JWT 토큰 검증
// Design Ref: D-P00.3
// CSAP: D-08-01 인증 관리 — RS256, 15분 만료

import type { TokenPayload } from '@public-saas/types';

/**
 * 토큰 검증 옵션
 */
export interface VerifyTokenOptions {
  /** RS256 공개 키 (PEM 형식) */
  publicKey: string;
  /** 허용할 알고리즘 (기본: RS256) */
  algorithms?: string[];
}

/**
 * JWT 토큰 검증
 *
 * RS256 알고리즘으로 서명된 토큰을 검증하고 페이로드를 반환합니다.
 * CSAP D-08 요건: 접근 토큰 15분 만료, 갱신 토큰 7일 만료.
 *
 * @param token - JWT 토큰 문자열
 * @param options - 검증 옵션
 * @returns 토큰 페이로드
 * @throws 토큰이 만료되었거나 유효하지 않은 경우
 *
 * @example
 * ```typescript
 * const payload = await verifyToken(bearerToken, {
 *   publicKey: process.env.JWT_PUBLIC_KEY!,
 * });
 * ```
 */
export async function verifyToken(_token: string, _options: VerifyTokenOptions): Promise<TokenPayload> {
  // NOTE: 실제 구현은 MTU-P01 (인증 서비스)에서 jsonwebtoken 또는 jose 라이브러리로 구현
  // 현재는 인터페이스 스켈레톤
  throw new Error('verifyToken은 MTU-P01 구현 시 완성됩니다. jose 라이브러리 RS256 검증 사용 예정.');
}
