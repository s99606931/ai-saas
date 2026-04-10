// 시크릿 참조 해석기
// Design Ref: SVC-CONFIG-R16 Plan
// Plan SC: FR-CFG.4
// CSAP: D-09 암호화 -- 하드코딩 시크릿 방지

/**
 * 시크릿 참조 패턴: $secret:KEY_NAME
 */
const SECRET_PATTERN = /^\$secret:(.+)$/;

/**
 * 하드코딩 시크릿 탐지 패턴
 */
const HARDCODED_PATTERNS = [
  /^sk-[a-zA-Z0-9]{20,}$/, // API 키
  /^ghp_[a-zA-Z0-9]{36}$/, // GitHub 토큰
  /^-----BEGIN (RSA |EC )?PRIVATE KEY-----/, // PEM 키
  /^[a-f0-9]{64}$/, // 256-bit hex 키
];

/**
 * 시크릿 해석 결과
 */
export interface SecretResolutionResult {
  /** 성공적으로 해석된 시크릿 수 */
  resolved: number;
  /** 미해석 시크릿 참조 */
  unresolved: string[];
  /** 하드코딩 시크릿 의심 필드 */
  hardcodedSuspects: string[];
  /** 해석된 설정 */
  config: Record<string, unknown>;
}

/**
 * 시크릿 참조 해석기
 *
 * 설정 내의 `$secret:KEY_NAME` 참조를 환경변수에서 해석합니다.
 * 하드코딩된 시크릿 패턴을 탐지합니다.
 */
export class SecretResolver {
  private readonly envProvider: (key: string) => string | undefined;

  /**
   * @param envProvider 환경변수 제공 함수 (기본: process.env)
   */
  constructor(envProvider?: (key: string) => string | undefined) {
    this.envProvider = envProvider ?? ((key) => process.env[key]);
  }

  /**
   * 설정 내의 모든 시크릿 참조 해석
   */
  resolve(config: Record<string, unknown>): SecretResolutionResult {
    const resolved: Record<string, unknown> = {};
    let resolvedCount = 0;
    const unresolved: string[] = [];
    const hardcodedSuspects: string[] = [];

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        const secretMatch = SECRET_PATTERN.exec(value);

        if (secretMatch) {
          // 시크릿 참조 해석
          const secretKey = secretMatch[1]!;
          const secretValue = this.envProvider(secretKey);

          if (secretValue !== undefined) {
            resolved[key] = secretValue;
            resolvedCount++;
          } else {
            unresolved.push(key);
            resolved[key] = value; // 원본 유지
          }
        } else {
          // 하드코딩 시크릿 탐지
          if (this.isHardcodedSecret(value)) {
            hardcodedSuspects.push(key);
          }
          resolved[key] = value;
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // 중첩 객체 재귀 해석
        const nested = this.resolve(value as Record<string, unknown>);
        resolved[key] = nested.config;
        resolvedCount += nested.resolved;
        unresolved.push(...nested.unresolved.map((u) => `${key}.${u}`));
        hardcodedSuspects.push(...nested.hardcodedSuspects.map((h) => `${key}.${h}`));
      } else {
        resolved[key] = value;
      }
    }

    return {
      resolved: resolvedCount,
      unresolved,
      hardcodedSuspects,
      config: resolved,
    };
  }

  /**
   * 단일 값의 시크릿 참조 여부 확인
   */
  isSecretReference(value: string): boolean {
    return SECRET_PATTERN.test(value);
  }

  /**
   * 하드코딩 시크릿 패턴 탐지
   */
  isHardcodedSecret(value: string): boolean {
    return HARDCODED_PATTERNS.some((pattern) => pattern.test(value));
  }
}
