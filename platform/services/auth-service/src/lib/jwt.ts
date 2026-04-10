// JWT RS256 토큰 발급/검증
// Design Ref: DESIGN-MTU-P01 Section 3
// Plan SC: FR-P01.1, FR-P01.2
// CSAP: D-08-01 인증 관리

import { SignJWT, jwtVerify, importPKCS8, importSPKI, type KeyLike } from 'jose';
import type { TokenPayload } from '@public-saas/types';
import { AUTH_CONSTANTS } from '@public-saas/auth-sdk';

const ALGORITHM = AUTH_CONSTANTS.JWT_ALGORITHM;

/** JWT 키 ID — 키 회전 지원 (Design Ref: SVC-AUTH-R1 DESIGN §5) */
const KEY_ID = process.env['JWT_KEY_ID'] ?? 'key-1';

let cachedPrivateKey: KeyLike | null = null;
let cachedPublicKey: KeyLike | null = null;

/**
 * RSA 비밀 키 로드 (캐시)
 */
async function getPrivateKey(): Promise<KeyLike> {
  if (!cachedPrivateKey) {
    const keyData = process.env['JWT_PRIVATE_KEY'];
    if (!keyData) {
      throw new Error('JWT_PRIVATE_KEY 환경 변수가 설정되지 않았습니다');
    }
    cachedPrivateKey = await importPKCS8(keyData, ALGORITHM);
  }
  return cachedPrivateKey;
}

/**
 * RSA 공개 키 로드 (캐시)
 */
async function getPublicKey(): Promise<KeyLike> {
  if (!cachedPublicKey) {
    const keyData = process.env['JWT_PUBLIC_KEY'];
    if (!keyData) {
      throw new Error('JWT_PUBLIC_KEY 환경 변수가 설정되지 않았습니다');
    }
    cachedPublicKey = await importSPKI(keyData, ALGORITHM);
  }
  return cachedPublicKey;
}

/**
 * 접근 토큰 발급 (15분 만료 — CSAP D-08)
 *
 * @param payload - 토큰 페이로드
 * @returns JWT 토큰 문자열
 */
export async function signAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  const privateKey = await getPrivateKey();

  // Plan SC: FR-AUTH.5 — kid 헤더 포함 (키 회전 지원)
  return new SignJWT({
    tenantId: payload.tenantId,
    role: payload.role,
    permissions: payload.permissions,
  })
    .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT', kid: KEY_ID })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_SECONDS}s`)
    .sign(privateKey);
}

/**
 * 갱신 토큰 발급 (7일 만료)
 *
 * @param userId - 사용자 ID
 * @param tenantId - 테넌트 ID
 * @returns JWT 갱신 토큰 문자열
 */
export async function signRefreshToken(userId: string, tenantId: string): Promise<string> {
  const privateKey = await getPrivateKey();

  // Plan SC: FR-AUTH.5 — kid 헤더 포함 (키 회전 지원)
  return new SignJWT({ tenantId, type: 'refresh' })
    .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT', kid: KEY_ID })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_SECONDS}s`)
    .sign(privateKey);
}

/**
 * 토큰 검증
 *
 * @param token - JWT 토큰 문자열
 * @returns 토큰 페이로드
 * @throws 토큰이 만료되었거나 유효하지 않은 경우
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const publicKey = await getPublicKey();

  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: [ALGORITHM],
  });

  return {
    sub: payload.sub as string,
    tenantId: payload['tenantId'] as string,
    role: payload['role'] as TokenPayload['role'],
    permissions: (payload['permissions'] as string[]) ?? [],
    iat: payload.iat as number,
    exp: payload.exp as number,
  };
}
