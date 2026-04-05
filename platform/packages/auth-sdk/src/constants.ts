// 인증 상수
// Design Ref: D-P00.3
// CSAP: D-08 접근 통제

/**
 * 인증 관련 상수 (CSAP D-08 준수)
 */
export const AUTH_CONSTANTS = {
  /** 접근 토큰 만료 시간 (15분) — CSAP D-08 */
  ACCESS_TOKEN_EXPIRES_SECONDS: 900,
  /** 갱신 토큰 만료 시간 (7일) */
  REFRESH_TOKEN_EXPIRES_SECONDS: 604800,
  /** 최대 동시 세션 수 (3개) — CSAP D-08 */
  MAX_CONCURRENT_SESSIONS: 3,
  /** 로그인 실패 허용 횟수 (5회) */
  MAX_LOGIN_ATTEMPTS: 5,
  /** 계정 잠금 시간 (30분) */
  ACCOUNT_LOCK_DURATION_SECONDS: 1800,
  /** 비밀번호 최소 길이 (8자) */
  PASSWORD_MIN_LENGTH: 8,
  /** 비밀번호 복잡도 규칙 (대소문자+숫자+특수문자) */
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  /** JWT 알고리즘 */
  JWT_ALGORITHM: 'RS256' as const,
  /** bcrypt 솔트 라운드 */
  BCRYPT_SALT_ROUNDS: 12,
} as const;
