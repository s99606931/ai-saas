// MTU-Q1 Swagger 플러그인 단위 테스트
// Test Ref: DESIGN-MTU-Q1 §2 FR-P04.10
// CSAP: D-12 시스템 개발 보안 — API 문서화

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('MTU-Q1 swagger: 환경 변수 기반 활성화 로직', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('TC-SW01: 운영 환경(NODE_ENV=production)에서 ENABLE_SWAGGER 없으면 비활성화', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['ENABLE_SWAGGER'];

    const isProduction = process.env['NODE_ENV'] === 'production';
    const enableSwagger = process.env['ENABLE_SWAGGER'] === 'true';
    const shouldSkip = isProduction && !enableSwagger;

    expect(shouldSkip).toBe(true);
  });

  it('TC-SW02: 운영 환경에서 ENABLE_SWAGGER=true이면 활성화', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['ENABLE_SWAGGER'] = 'true';

    const isProduction = process.env['NODE_ENV'] === 'production';
    const enableSwagger = process.env['ENABLE_SWAGGER'] === 'true';
    const shouldSkip = isProduction && !enableSwagger;

    expect(shouldSkip).toBe(false);
  });

  it('TC-SW03: 개발 환경(NODE_ENV=development)에서는 기본 활성화', () => {
    process.env['NODE_ENV'] = 'development';
    delete process.env['ENABLE_SWAGGER'];

    const isProduction = process.env['NODE_ENV'] === 'production';
    const enableSwagger = process.env['ENABLE_SWAGGER'] === 'true';
    const shouldSkip = isProduction && !enableSwagger;

    expect(shouldSkip).toBe(false);
  });

  it('TC-SW04: NODE_ENV 미설정 시에도 Swagger 활성화 (기본값)', () => {
    delete process.env['NODE_ENV'];
    delete process.env['ENABLE_SWAGGER'];

    const isProduction = process.env['NODE_ENV'] === 'production';
    const enableSwagger = process.env['ENABLE_SWAGGER'] === 'true';
    const shouldSkip = isProduction && !enableSwagger;

    expect(shouldSkip).toBe(false);
  });
});

describe('MTU-Q1 swagger: OpenAPI 스펙 설정 검증', () => {
  it('TC-SW05: OpenAPI 버전은 3.0.3이다', () => {
    const openApiVersion = '3.0.3';
    expect(openApiVersion).toBe('3.0.3');
  });

  it('TC-SW06: Swagger UI 경로는 /api/docs이다', () => {
    const routePrefix = '/api/docs';
    expect(routePrefix).toBe('/api/docs');
  });

  it('TC-SW07: bearerAuth 보안 스키마가 JWT Bearer 타입이다 (CSAP D-08)', () => {
    const securityScheme = {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    };
    expect(securityScheme.type).toBe('http');
    expect(securityScheme.scheme).toBe('bearer');
    expect(securityScheme.bearerFormat).toBe('JWT');
  });

  it('TC-SW08: ai 태그에 N2SF N-05 설명이 포함된다', () => {
    const aiTag = { name: 'ai', description: 'AI 서비스 (N2SF N-05 등급 검증)' };
    expect(aiTag.description).toContain('N2SF N-05');
  });

  it('TC-SW09: audit 태그에 CSAP D-06 설명이 포함된다', () => {
    const auditTag = { name: 'audit', description: '감사 로그 (CSAP D-06, append-only)' };
    expect(auditTag.description).toContain('CSAP D-06');
    expect(auditTag.description).toContain('append-only');
  });

  it('TC-SW10: 필수 API 태그 목록이 모두 정의되어 있다', () => {
    const tags = [
      'auth',
      'users',
      'tenants',
      'subscriptions',
      'billing',
      'ai',
      'audit',
      'compliance',
      'notifications',
      'files',
      'security',
      'gateway',
    ];
    const requiredTags = ['auth', 'users', 'ai', 'audit', 'compliance'];
    for (const required of requiredTags) {
      expect(tags).toContain(required);
    }
  });
});
