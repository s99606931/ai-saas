// 설정 스키마 검증기
// Design Ref: SVC-CONFIG-R16 Plan
// Plan SC: FR-CFG.3
// CSAP: D-12 시스템 개발 보안 -- 입력 검증

/**
 * 필드 타입
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/**
 * 스키마 필드 정의
 */
export interface SchemaField {
  /** 필드 타입 */
  type: FieldType;
  /** 필수 여부 (기본: true) */
  required?: boolean;
  /** 기본값 */
  defaultValue?: unknown;
  /** 설명 */
  description?: string;
  /** 허용 값 목록 (enum) */
  allowedValues?: unknown[];
  /** 최소값 (number) */
  min?: number;
  /** 최대값 (number) */
  max?: number;
  /** 최소 길이 (string) */
  minLength?: number;
  /** 최대 길이 (string) */
  maxLength?: number;
}

/**
 * 설정 스키마 정의
 */
export type ConfigSchema = Record<string, SchemaField>;

/**
 * 검증 결과
 */
export interface ValidationResult {
  /** 검증 통과 여부 */
  valid: boolean;
  /** 오류 목록 */
  errors: ValidationError[];
  /** 기본값이 적용된 설정 */
  config: Record<string, unknown>;
}

/**
 * 검증 오류
 */
export interface ValidationError {
  /** 필드 경로 */
  field: string;
  /** 오류 메시지 */
  message: string;
  /** 오류 유형 */
  type: 'missing' | 'type_mismatch' | 'out_of_range' | 'invalid_value';
}

/**
 * 설정 스키마 검증기
 *
 * 설정 값의 타입, 범위, 필수 여부를 검증하고
 * 누락된 필드에 기본값을 적용합니다.
 */
export class ConfigValidator {
  private readonly schema: ConfigSchema;

  constructor(schema: ConfigSchema) {
    this.schema = schema;
  }

  /**
   * 설정 검증
   */
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: ValidationError[] = [];
    const result: Record<string, unknown> = { ...config };

    for (const [field, fieldSchema] of Object.entries(this.schema)) {
      const value = config[field];
      const isRequired = fieldSchema.required !== false;

      // 1. 필수 필드 체크
      if (value === undefined || value === null) {
        if (fieldSchema.defaultValue !== undefined) {
          result[field] = fieldSchema.defaultValue;
          continue;
        }

        if (isRequired) {
          errors.push({
            field,
            message: `필수 설정 '${field}'이(가) 누락되었습니다`,
            type: 'missing',
          });
        }
        continue;
      }

      // 2. 타입 체크
      if (!this.checkType(value, fieldSchema.type)) {
        errors.push({
          field,
          message: `'${field}'의 타입이 올바르지 않습니다 (기대: ${fieldSchema.type}, 실제: ${typeof value})`,
          type: 'type_mismatch',
        });
        continue;
      }

      // 3. 허용 값 체크
      if (fieldSchema.allowedValues && !fieldSchema.allowedValues.includes(value)) {
        errors.push({
          field,
          message: `'${field}'의 값이 허용 범위에 없습니다 (허용: ${JSON.stringify(fieldSchema.allowedValues)})`,
          type: 'invalid_value',
        });
        continue;
      }

      // 4. 숫자 범위 체크
      if (fieldSchema.type === 'number' && typeof value === 'number') {
        if (fieldSchema.min !== undefined && value < fieldSchema.min) {
          errors.push({
            field,
            message: `'${field}'의 값이 최소값(${fieldSchema.min}) 미만입니다`,
            type: 'out_of_range',
          });
        }
        if (fieldSchema.max !== undefined && value > fieldSchema.max) {
          errors.push({
            field,
            message: `'${field}'의 값이 최대값(${fieldSchema.max})을 초과합니다`,
            type: 'out_of_range',
          });
        }
      }

      // 5. 문자열 길이 체크
      if (fieldSchema.type === 'string' && typeof value === 'string') {
        if (fieldSchema.minLength !== undefined && value.length < fieldSchema.minLength) {
          errors.push({
            field,
            message: `'${field}'의 길이가 최소(${fieldSchema.minLength})보다 짧습니다`,
            type: 'out_of_range',
          });
        }
        if (fieldSchema.maxLength !== undefined && value.length > fieldSchema.maxLength) {
          errors.push({
            field,
            message: `'${field}'의 길이가 최대(${fieldSchema.maxLength})를 초과합니다`,
            type: 'out_of_range',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      config: result,
    };
  }

  /**
   * 스키마 필드 목록 반환
   */
  getFields(): string[] {
    return Object.keys(this.schema);
  }

  /**
   * 필수 필드 목록 반환
   */
  getRequiredFields(): string[] {
    return Object.entries(this.schema)
      .filter(([, f]) => f.required !== false && f.defaultValue === undefined)
      .map(([name]) => name);
  }

  /**
   * 타입 검사
   */
  private checkType(value: unknown, expectedType: FieldType): boolean {
    switch (expectedType) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number' && !isNaN(value);
      case 'boolean': return typeof value === 'boolean';
      case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array': return Array.isArray(value);
    }
  }
}
