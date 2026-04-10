// ConfigValidator 단위 테스트
// Design Ref: SVC-CONFIG-R16 Plan
// Plan SC: FR-CFG.3

import { describe, it, expect } from 'vitest';
import { ConfigValidator, type ConfigSchema } from '../src/config-validator.js';

describe('ConfigValidator', () => {
  const schema: ConfigSchema = {
    host: { type: 'string', required: true, description: '서버 호스트' },
    port: { type: 'number', required: true, min: 1, max: 65535 },
    debug: { type: 'boolean', required: false, defaultValue: false },
    env: { type: 'string', allowedValues: ['development', 'staging', 'production'] },
    name: { type: 'string', minLength: 1, maxLength: 50 },
  };

  it('유효한 설정을 통과시킨다', () => {
    const validator = new ConfigValidator(schema);
    const result = validator.validate({
      host: 'localhost',
      port: 3000,
      debug: true,
      env: 'production',
      name: 'auth-service',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('필수 필드 누락 시 에러를 반환한다', () => {
    const validator = new ConfigValidator(schema);
    const result = validator.validate({
      debug: true,
      env: 'production',
      name: 'test',
    });

    expect(result.valid).toBe(false);
    const missing = result.errors.filter((e) => e.type === 'missing');
    expect(missing).toHaveLength(2); // host, port
  });

  it('기본값을 자동 적용한다', () => {
    const validator = new ConfigValidator(schema);
    const result = validator.validate({
      host: 'localhost',
      port: 3000,
      env: 'development',
      name: 'test',
    });

    expect(result.valid).toBe(true);
    expect(result.config['debug']).toBe(false);
  });

  it('타입 불일치를 감지한다', () => {
    const validator = new ConfigValidator(schema);
    const result = validator.validate({
      host: 123, // string 기대
      port: 'not-a-number', // number 기대
      env: 'production',
      name: 'test',
    });

    expect(result.valid).toBe(false);
    const typeErrors = result.errors.filter((e) => e.type === 'type_mismatch');
    expect(typeErrors).toHaveLength(2);
  });

  it('허용 값 외의 값을 거부한다', () => {
    const validator = new ConfigValidator(schema);
    const result = validator.validate({
      host: 'localhost',
      port: 3000,
      env: 'invalid-env',
      name: 'test',
    });

    expect(result.valid).toBe(false);
    const invalidValue = result.errors.find((e) => e.type === 'invalid_value');
    expect(invalidValue).toBeDefined();
    expect(invalidValue!.field).toBe('env');
  });

  it('숫자 범위를 검증한다', () => {
    const validator = new ConfigValidator(schema);

    const result1 = validator.validate({
      host: 'localhost',
      port: 0, // min: 1
      env: 'production',
      name: 'test',
    });
    expect(result1.valid).toBe(false);
    expect(result1.errors[0]!.type).toBe('out_of_range');

    const result2 = validator.validate({
      host: 'localhost',
      port: 99999, // max: 65535
      env: 'production',
      name: 'test',
    });
    expect(result2.valid).toBe(false);
  });

  it('문자열 길이를 검증한다', () => {
    const validator = new ConfigValidator(schema);
    const result = validator.validate({
      host: 'localhost',
      port: 3000,
      env: 'production',
      name: '', // minLength: 1
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]!.field).toBe('name');
  });

  it('getFields()가 스키마 필드 목록을 반환한다', () => {
    const validator = new ConfigValidator(schema);
    expect(validator.getFields()).toEqual(['host', 'port', 'debug', 'env', 'name']);
  });

  it('getRequiredFields()가 필수 필드만 반환한다', () => {
    const validator = new ConfigValidator(schema);
    const required = validator.getRequiredFields();
    expect(required).toContain('host');
    expect(required).toContain('port');
    expect(required).not.toContain('debug'); // defaultValue 있음
  });
});
