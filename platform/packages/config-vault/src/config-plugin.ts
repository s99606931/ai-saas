// 중앙 설정 관리 Fastify 플러그인
// Design Ref: SVC-CONFIG-R16 Plan
// Plan SC: FR-CFG.1
// CSAP: D-09 암호화

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { ConfigLoader } from './config-loader.js';
import { ConfigValidator, type ConfigSchema } from './config-validator.js';
import { SecretResolver } from './secret-resolver.js';

/**
 * 설정 플러그인 옵션
 */
export interface ConfigPluginOptions extends FastifyPluginOptions {
  /** 기본 설정 */
  defaults?: Record<string, unknown>;
  /** 환경별 설정 */
  environmentConfig?: Record<string, unknown>;
  /** 환경변수 접두사 */
  envPrefix?: string;
  /** 환경변수 → 설정 키 매핑 */
  envMapping?: Record<string, string>;
  /** 검증 스키마 */
  schema?: ConfigSchema;
  /** 시크릿 참조 해석 활성화 (기본: true) */
  resolveSecrets?: boolean;
}

/**
 * config decorator 타입
 */
export interface ConfigDecorator {
  loader: ConfigLoader;
  get: <T>(key: string, defaultValue?: T) => T;
  has: (key: string) => boolean;
  set: (key: string, value: unknown) => void;
  getAll: () => Readonly<Record<string, unknown>>;
}

// Fastify 타입 확장
declare module 'fastify' {
  interface FastifyInstance {
    config: ConfigDecorator;
  }
}

/**
 * configPlugin -- 중앙 설정 관리 Fastify 플러그인
 */
async function configPluginImpl(
  app: FastifyInstance,
  opts: ConfigPluginOptions,
): Promise<void> {
  const loader = new ConfigLoader();

  // 1. 기본 설정 로드
  if (opts.defaults) {
    loader.loadDefaults(opts.defaults);
  }

  // 2. 환경별 설정 로드
  if (opts.environmentConfig) {
    loader.loadEnvironmentConfig(opts.environmentConfig);
  }

  // 3. 환경변수 로드
  if (opts.envPrefix || opts.envMapping) {
    loader.loadFromEnv(opts.envPrefix, opts.envMapping);
  }

  // 4. 시크릿 참조 해석
  if (opts.resolveSecrets !== false) {
    const resolver = new SecretResolver();
    const allConfig = loader.getAll();
    const result = resolver.resolve(allConfig as Record<string, unknown>);

    // 해석된 시크릿을 런타임 설정으로 적용
    for (const [key, value] of Object.entries(result.config)) {
      if (value !== (allConfig as Record<string, unknown>)[key]) {
        loader.set(key, value);
      }
    }

    // 미해석 시크릿 경고
    if (result.unresolved.length > 0) {
      app.log.warn(`미해석 시크릿 참조: ${result.unresolved.join(', ')}`);
    }

    // 하드코딩 시크릿 경고
    if (result.hardcodedSuspects.length > 0) {
      app.log.warn(`하드코딩 시크릿 의심: ${result.hardcodedSuspects.join(', ')}`);
    }
  }

  // 5. 스키마 검증
  if (opts.schema) {
    const validator = new ConfigValidator(opts.schema);
    const result = validator.validate(loader.getAll() as Record<string, unknown>);

    if (!result.valid) {
      const errorMessages = result.errors.map((e) => `  - ${e.field}: ${e.message}`).join('\n');
      throw new Error(`설정 검증 실패:\n${errorMessages}`);
    }
  }

  // Fastify decorator 등록
  app.decorate('config', {
    loader,
    get: <T>(key: string, defaultValue?: T) => loader.get<T>(key, defaultValue),
    has: (key: string) => loader.has(key),
    set: (key: string, value: unknown) => loader.set(key, value),
    getAll: () => loader.getAll(),
  });
}

export const configPlugin = fp(configPluginImpl, {
  name: '@public-saas/config-vault',
  fastify: '5.x',
});
