// Config Loader -- 환경변수 기반 설정 관리
// Design Ref: SVC-CONFIG-R31 DESIGN
// Plan SC: FR-CF.1, FR-CF.2, FR-CF.3, FR-CF.4, FR-CF.5, FR-CF.6
// CSAP: D-09 암호화 키 관리

import { type ZodSchema, type ZodError } from 'zod';

/**
 * Config Loader 옵션
 */
export interface ConfigLoaderOptions {
  /** 환경변수 접두사 (예: 'APP_') */
  prefix?: string;
  /** 마스킹 대상 키 패턴 (기본: ['password', 'secret', 'key', 'token']) */
  sensitiveKeys?: string[];
  /** 검증 실패 시 프로세스 종료 (기본: true, 테스트 시 false) */
  exitOnError?: boolean;
  /** 환경변수 소스 (테스트 시 오버라이드) */
  envSource?: Record<string, string | undefined>;
}

/**
 * 설정 로드 에러
 * Plan SC: FR-CF.4
 */
export class ConfigValidationError extends Error {
  constructor(
    public readonly errors: Array<{ field: string; message: string }>,
  ) {
    const summary = errors.map((e) => `  - ${e.field}: ${e.message}`).join('\n');
    super(`설정 검증 실패:\n${summary}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * 환경변수에서 설정을 로드하고 Zod 스키마로 검증합니다.
 *
 * 12-Factor App 원칙에 따라 환경변수에서 설정을 로드합니다.
 * Zod 스키마의 coerce 기능으로 문자열 → 숫자/불리언 자동 변환합니다.
 * 검증 실패 시 상세 에러와 함께 빠른 실패합니다.
 *
 * Plan SC: FR-CF.1 (env 로드), FR-CF.2 (Zod 검증), FR-CF.3 (기본값/타입변환),
 *          FR-CF.4 (빠른 실패), FR-CF.6 (접두사)
 */
export function loadConfig<T>(
  schema: ZodSchema<T>,
  options: ConfigLoaderOptions = {},
): T {
  const envSource = options.envSource ?? process.env;
  const prefix = options.prefix ?? '';
  const exitOnError = options.exitOnError !== false;

  // 접두사 기반 필터링 (FR-CF.6)
  let envData: Record<string, string | undefined>;

  if (prefix) {
    envData = {};
    for (const [key, value] of Object.entries(envSource)) {
      if (key.startsWith(prefix)) {
        // 접두사 제거 후 소문자 변환 (APP_DB_HOST → db_host)
        const shortKey = key.slice(prefix.length);
        envData[shortKey] = value;
        // 원본 키도 보존 (스키마에서 직접 참조할 수 있도록)
        envData[key] = value;
      }
    }
  } else {
    envData = { ...envSource };
  }

  // Zod 스키마 검증 (FR-CF.2, FR-CF.3)
  const result = schema.safeParse(envData);

  if (!result.success) {
    const errors = formatZodErrors(result.error);

    if (exitOnError && !options.envSource) {
      // 프로덕션 환경: 에러 출력 후 종료
      console.error(`[ConfigLoader] 설정 검증 실패:\n${errors.map((e) => `  - ${e.field}: ${e.message}`).join('\n')}`);
      process.exit(1);
    }

    throw new ConfigValidationError(errors);
  }

  return result.data;
}

/**
 * 설정 객체를 안전하게 덤프합니다 (민감 정보 마스킹).
 * Plan SC: FR-CF.5
 *
 * CSAP D-09: 민감 설정(비밀번호, 키, 토큰)은 절대 평문 노출 금지
 */
export function dumpConfig(
  config: Record<string, unknown>,
  sensitiveKeys?: string[],
): Record<string, string> {
  const sensitivePatterns = sensitiveKeys ?? [
    'password',
    'secret',
    'key',
    'token',
    'credential',
    'private',
  ];

  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(config)) {
    const isSensitive = sensitivePatterns.some((pattern) =>
      key.toLowerCase().includes(pattern.toLowerCase()),
    );

    result[key] = isSensitive ? '***MASKED***' : String(value);
  }

  return result;
}

// -- 내부 함수 --

function formatZodErrors(zodError: ZodError): Array<{ field: string; message: string }> {
  return zodError.errors.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}
