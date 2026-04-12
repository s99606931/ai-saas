// Config Loader 테스트
// Design Ref: SVC-CONFIG-R31 DESIGN
// Plan SC: FR-CF.1~FR-CF.6

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { loadConfig, dumpConfig, ConfigValidationError } from '../src/config-loader.js';

describe('ConfigLoader', () => {
  describe('FR-CF.1: 환경변수에서 설정 로드', () => {
    it('envSource에서 설정을 로드한다', () => {
      const schema = z.object({
        HOST: z.string(),
        PORT: z.string(),
      });

      const config = loadConfig(schema, {
        envSource: { HOST: 'localhost', PORT: '3000' },
        exitOnError: false,
      });

      expect(config.HOST).toBe('localhost');
      expect(config.PORT).toBe('3000');
    });
  });

  describe('FR-CF.2: Zod 스키마 검증', () => {
    it('유효한 설정을 통과시킨다', () => {
      const schema = z.object({
        DB_HOST: z.string(),
        DB_PORT: z.coerce.number().int().min(1).max(65535),
      });

      const config = loadConfig(schema, {
        envSource: { DB_HOST: 'db.local', DB_PORT: '5432' },
        exitOnError: false,
      });

      expect(config.DB_HOST).toBe('db.local');
      expect(config.DB_PORT).toBe(5432);
    });

    it('잘못된 값을 거부한다', () => {
      const schema = z.object({
        PORT: z.coerce.number().int().min(1).max(65535),
      });

      expect(() => loadConfig(schema, {
        envSource: { PORT: 'not-a-number' },
        exitOnError: false,
      })).toThrow(ConfigValidationError);
    });
  });

  describe('FR-CF.3: 기본값 + 타입 변환', () => {
    it('기본값이 적용된다', () => {
      const schema = z.object({
        HOST: z.string().default('0.0.0.0'),
        PORT: z.coerce.number().default(3000),
        DEBUG: z.string().default('false'),
      });

      const config = loadConfig(schema, {
        envSource: {},
        exitOnError: false,
      });

      expect(config.HOST).toBe('0.0.0.0');
      expect(config.PORT).toBe(3000);
      expect(config.DEBUG).toBe('false');
    });

    it('문자열을 숫자로 변환한다', () => {
      const schema = z.object({
        MAX_CONNECTIONS: z.coerce.number(),
        TIMEOUT_MS: z.coerce.number(),
      });

      const config = loadConfig(schema, {
        envSource: { MAX_CONNECTIONS: '100', TIMEOUT_MS: '5000' },
        exitOnError: false,
      });

      expect(config.MAX_CONNECTIONS).toBe(100);
      expect(config.TIMEOUT_MS).toBe(5000);
    });

    it('문자열을 불리언으로 변환한다', () => {
      const booleanFromString = z.string().transform((v) => v === 'true');

      const schema = z.object({
        ENABLE_CACHE: booleanFromString,
        ENABLE_DEBUG: booleanFromString,
      });

      const config = loadConfig(schema, {
        envSource: { ENABLE_CACHE: 'true', ENABLE_DEBUG: 'false' },
        exitOnError: false,
      });

      expect(config.ENABLE_CACHE).toBe(true);
      expect(config.ENABLE_DEBUG).toBe(false);
    });
  });

  describe('FR-CF.4: 필수 설정 누락 시 빠른 실패', () => {
    it('필수 설정 누락 시 ConfigValidationError를 던진다', () => {
      const schema = z.object({
        REQUIRED_KEY: z.string(),
        ALSO_REQUIRED: z.string(),
      });

      try {
        loadConfig(schema, { envSource: {}, exitOnError: false });
        expect.fail('에러가 발생해야 함');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigValidationError);
        const validationErr = err as ConfigValidationError;
        expect(validationErr.errors.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('에러 메시지에 누락된 필드를 포함한다', () => {
      const schema = z.object({
        DB_HOST: z.string(),
      });

      try {
        loadConfig(schema, { envSource: {}, exitOnError: false });
        expect.fail('에러가 발생해야 함');
      } catch (err) {
        const validationErr = err as ConfigValidationError;
        expect(validationErr.message).toContain('DB_HOST');
      }
    });
  });

  describe('FR-CF.5: 민감 설정 마스킹', () => {
    it('기본 민감 키를 마스킹한다', () => {
      const config = {
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_PASSWORD: 'super-secret',
        JWT_SECRET: 'jwt-key-123',
        API_KEY: 'ak-12345',
        NODE_ENV: 'production',
      };

      const dumped = dumpConfig(config);

      expect(dumped.DB_HOST).toBe('localhost');
      expect(dumped.DB_PORT).toBe('5432');
      expect(dumped.DB_PASSWORD).toBe('***MASKED***');
      expect(dumped.JWT_SECRET).toBe('***MASKED***');
      expect(dumped.API_KEY).toBe('***MASKED***');
      expect(dumped.NODE_ENV).toBe('production');
    });

    it('커스텀 민감 키를 지정할 수 있다', () => {
      const config = {
        CUSTOM_FIELD: 'sensitive-data',
        NORMAL: 'visible',
      };

      const dumped = dumpConfig(config, ['custom']);

      expect(dumped.CUSTOM_FIELD).toBe('***MASKED***');
      expect(dumped.NORMAL).toBe('visible');
    });
  });

  describe('FR-CF.6: 접두사 기반 그룹화', () => {
    it('접두사로 환경변수를 필터링한다', () => {
      const schema = z.object({
        HOST: z.string(),
        PORT: z.coerce.number(),
      });

      const config = loadConfig(schema, {
        prefix: 'APP_',
        envSource: {
          APP_HOST: 'localhost',
          APP_PORT: '8080',
          OTHER_VAR: 'ignored',
        },
        exitOnError: false,
      });

      expect(config.HOST).toBe('localhost');
      expect(config.PORT).toBe(8080);
    });

    it('접두사 없이도 동작한다', () => {
      const schema = z.object({
        DIRECT_KEY: z.string(),
      });

      const config = loadConfig(schema, {
        envSource: { DIRECT_KEY: 'value' },
        exitOnError: false,
      });

      expect(config.DIRECT_KEY).toBe('value');
    });
  });
});
