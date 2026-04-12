import { describe, it, expect, beforeEach } from 'vitest';
import { ApiSpecGeneratorAi, type EndpointSpec } from '../api-spec-generator-ai';

describe('ApiSpecGeneratorAi', () => {
  let generator: ApiSpecGeneratorAi;

  const userGet: EndpointSpec = {
    path: '/users/{id}',
    method: 'GET',
    summary: '사용자 조회',
    responseSchema: { id: 'string', name: 'string' },
    security: 'bearer',
    tags: ['users'],
  };

  const adminEndpoint: EndpointSpec = {
    path: '/admin/settings',
    method: 'POST',
    summary: '관리자 설정',
    requestBody: { setting: { type: 'string', required: true } },
    security: 'bearer',
    tags: ['admin'],
  };

  beforeEach(() => {
    generator = new ApiSpecGeneratorAi();
  });

  // FR-R173.1 엔드포인트 등록
  it('FR-R173.1 엔드포인트 등록', () => {
    generator.addEndpoint(userGet);
    expect(generator.listEndpoints()).toHaveLength(1);
  });

  it('FR-R173.1 감사 로그 기록', () => {
    generator.addEndpoint(userGet);
    const log = generator.getAuditLog();
    expect(log.some((e) => e.action === 'ENDPOINT_ADDED')).toBe(true);
  });

  // FR-R173.2 OpenAPI 생성
  it('FR-R173.2 OpenAPI 3.0 스펙 생성', () => {
    generator.addEndpoint(userGet);
    const spec = generator.generateOpenApi('Test API', '1.0.0');
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toBe('Test API');
    expect(spec.paths['/users/{id}']).toBeDefined();
  });

  it('FR-R173.2 POST 엔드포인트 requestBody 포함', () => {
    generator.addEndpoint(adminEndpoint);
    const spec = generator.generateOpenApi('Test', '1.0.0');
    const postOp = spec.paths['/admin/settings']?.['post'] as any;
    expect(postOp).toBeDefined();
    expect(postOp.requestBody).toBeDefined();
  });

  it('FR-R173.2 공개 엔드포인트 security 비어있음', () => {
    generator.addEndpoint({ ...userGet, path: '/health', method: 'GET', security: 'public' });
    const spec = generator.generateOpenApi('Test', '1.0.0');
    const op = spec.paths['/health']?.['get'] as any;
    expect(op.security).toHaveLength(0);
  });

  // FR-R173.3 보안 검사
  it('FR-R173.3 RBAC 없는 admin 경로 이슈 탐지', () => {
    generator.addEndpoint(adminEndpoint); // bearer only
    const issues = generator.validateSecurity();
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain('RBAC');
  });

  it('FR-R173.3 RBAC 있는 admin 경로 이슈 없음', () => {
    generator.addEndpoint({ ...adminEndpoint, security: 'rbac' });
    const issues = generator.validateSecurity();
    expect(issues).toHaveLength(0);
  });

  // FR-R173.4 중복 감지
  it('FR-R173.4 중복 경로 감지', () => {
    generator.addEndpoint(userGet);
    generator.addEndpoint(userGet); // duplicate
    const dups = generator.getDuplicates();
    expect(dups).toContain('GET:/users/{id}');
  });

  it('FR-R173.4 중복 없음', () => {
    generator.addEndpoint(userGet);
    expect(generator.getDuplicates()).toHaveLength(0);
  });

  // FR-R173.5 감사 로그
  it('FR-R173.5 스펙 생성 감사 로그', () => {
    generator.addEndpoint(userGet);
    generator.generateOpenApi('Test', '1.0.0');
    const log = generator.getAuditLog();
    expect(log.some((e) => e.action === 'SPEC_GENERATED')).toBe(true);
  });
});
