// Request Validator -- Zod 기반 입력 검증
// Design Ref: SVC-REQVALID-R28 DESIGN
// Plan SC: FR-RV.1, FR-RV.2, FR-RV.3, FR-RV.4, FR-RV.5, FR-RV.6
// CSAP: D-12 시스템 개발 보안

import { type ZodSchema, type ZodError } from 'zod';

/**
 * RFC 7807 Problem Details 개별 필드 에러
 */
export interface FieldError {
  /** 에러 발생 필드 경로 (예: "body.email") */
  field: string;
  /** 에러 메시지 */
  message: string;
  /** Zod 에러 코드 */
  code: string;
}

/**
 * RFC 7807 Problem Details 에러 응답
 * Plan SC: FR-RV.4
 */
export interface ProblemDetails {
  /** 에러 유형 URI */
  type: string;
  /** 에러 제목 */
  title: string;
  /** HTTP 상태 코드 */
  status: number;
  /** 상세 메시지 */
  detail: string;
  /** 필드별 에러 목록 */
  errors: FieldError[];
}

/**
 * 검증 스키마 정의
 * Plan SC: FR-RV.1, FR-RV.2, FR-RV.3
 */
export interface ValidationSchema<B = unknown, Q = unknown, P = unknown> {
  /** 요청 body 스키마 */
  body?: ZodSchema<B>;
  /** Query string 스키마 */
  query?: ZodSchema<Q>;
  /** URL 경로 파라미터 스키마 */
  params?: ZodSchema<P>;
}

/**
 * 검증 성공 결과
 * Plan SC: FR-RV.6
 */
export interface ValidationSuccess<B, Q, P> {
  success: true;
  data: {
    body: B;
    query: Q;
    params: P;
  };
}

/**
 * 검증 실패 결과
 * Plan SC: FR-RV.4
 */
export interface ValidationFailure {
  success: false;
  error: ProblemDetails;
}

export type ValidationResult<B, Q, P> = ValidationSuccess<B, Q, P> | ValidationFailure;

/**
 * 검증 옵션
 */
export interface ValidatorOptions {
  /** HTML 새니타이제이션 활성화 (기본: true) */
  sanitize?: boolean;
}

/**
 * HTML 새니타이제이션 (XSS 방지)
 * Plan SC: FR-RV.5
 *
 * 문자열 필드의 HTML 특수문자를 이스케이프합니다.
 * CSAP D-12: 시스템 개발 보안 (XSS 방지)
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&(?!amp;|lt;|gt;|quot;|#x27;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * 객체 내 모든 문자열 필드를 재귀적으로 새니타이제이션
 * Plan SC: FR-RV.5
 */
export function sanitizeDeep<T>(data: T): T {
  if (typeof data === 'string') {
    return sanitizeHtml(data) as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDeep(item)) as T;
  }

  if (data !== null && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = sanitizeDeep(value);
    }
    return result as T;
  }

  return data;
}

/**
 * ZodError를 RFC 7807 FieldError 배열로 변환
 * Plan SC: FR-RV.4
 */
function zodErrorToFieldErrors(zodError: ZodError, prefix: string): FieldError[] {
  return zodError.errors.map((issue) => {
    const path = issue.path.length > 0
      ? `${prefix}.${issue.path.join('.')}`
      : prefix;

    return {
      field: path,
      message: issue.message,
      code: issue.code,
    };
  });
}

/**
 * 요청 데이터를 검증합니다.
 *
 * Zod 스키마 기반으로 body, query, params를 검증하고
 * 타입 안전한 결과를 반환합니다.
 * 실패 시 RFC 7807 Problem Details 형식으로 에러를 반환합니다.
 *
 * CSAP D-12: 모든 사용자 입력 검증 필수
 *
 * Plan SC: FR-RV.1 (body), FR-RV.2 (query), FR-RV.3 (params),
 *          FR-RV.4 (에러 응답), FR-RV.5 (새니타이제이션), FR-RV.6 (타입 추론)
 */
export function validateRequest<B = unknown, Q = unknown, P = unknown>(
  schema: ValidationSchema<B, Q, P>,
  input: {
    body?: unknown;
    query?: unknown;
    params?: unknown;
  },
  options: ValidatorOptions = {},
): ValidationResult<B, Q, P> {
  const shouldSanitize = options.sanitize !== false;
  const allErrors: FieldError[] = [];

  let validatedBody: B = undefined as B;
  let validatedQuery: Q = undefined as Q;
  let validatedParams: P = undefined as P;

  // Body 검증 (FR-RV.1)
  if (schema.body) {
    const result = schema.body.safeParse(input.body);
    if (!result.success) {
      allErrors.push(...zodErrorToFieldErrors(result.error, 'body'));
    } else {
      validatedBody = shouldSanitize ? sanitizeDeep(result.data) : result.data;
    }
  }

  // Query 검증 (FR-RV.2)
  if (schema.query) {
    const result = schema.query.safeParse(input.query);
    if (!result.success) {
      allErrors.push(...zodErrorToFieldErrors(result.error, 'query'));
    } else {
      validatedQuery = shouldSanitize ? sanitizeDeep(result.data) : result.data;
    }
  }

  // Params 검증 (FR-RV.3)
  if (schema.params) {
    const result = schema.params.safeParse(input.params);
    if (!result.success) {
      allErrors.push(...zodErrorToFieldErrors(result.error, 'params'));
    } else {
      validatedParams = shouldSanitize ? sanitizeDeep(result.data) : result.data;
    }
  }

  // 에러가 있으면 RFC 7807 형식 반환 (FR-RV.4)
  if (allErrors.length > 0) {
    return {
      success: false,
      error: {
        type: 'https://api.public-saas.go.kr/errors/validation',
        title: '요청 검증 실패',
        status: 400,
        detail: `${allErrors.length}개의 검증 오류가 발견되었습니다.`,
        errors: allErrors,
      },
    };
  }

  // 성공: 타입 안전한 결과 반환 (FR-RV.6)
  return {
    success: true,
    data: {
      body: validatedBody,
      query: validatedQuery,
      params: validatedParams,
    },
  };
}
