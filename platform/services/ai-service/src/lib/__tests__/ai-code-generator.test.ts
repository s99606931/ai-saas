import { describe, it, expect, beforeEach } from 'vitest';
import { AiCodeGenerator, type CodeSpec } from '../ai-code-generator';

describe('AiCodeGenerator', () => {
  let generator: AiCodeGenerator;

  const baseSpec: CodeSpec = {
    language: 'typescript',
    template: 'crud',
    entityName: 'User',
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'nickname', type: 'string', required: false },
    ],
    tenantId: 'tenant-1',
  };

  beforeEach(() => {
    generator = new AiCodeGenerator();
  });

  // FR-R172.1 스펙 등록
  it('FR-R172.1 스펙 등록 및 ID 반환', () => {
    const id = generator.registerSpec(baseSpec);
    expect(id).toMatch(/spec-\d+/);
  });

  it('FR-R172.1 다중 스펙 고유 ID', () => {
    const id1 = generator.registerSpec(baseSpec);
    const id2 = generator.registerSpec({ ...baseSpec, entityName: 'Product' });
    expect(id1).not.toBe(id2);
  });

  // FR-R172.2 코드 생성
  it('FR-R172.2 TypeScript CRUD 코드 생성', () => {
    const id = generator.registerSpec(baseSpec);
    const result = generator.generate(id);
    expect(result.code).toContain('User');
    expect(result.language).toBe('typescript');
    expect(result.lineCount).toBeGreaterThan(0);
  });

  it('FR-R172.2 validator 템플릿 생성', () => {
    const id = generator.registerSpec({ ...baseSpec, template: 'validator' });
    const result = generator.generate(id);
    expect(result.code).toContain('validate');
    expect(result.code).toContain('throw');
  });

  it('FR-R172.2 없는 스펙 생성 시 에러', () => {
    expect(() => generator.generate('nonexistent')).toThrow();
  });

  // FR-R172.3 이력 조회
  it('FR-R172.3 생성 이력 조회', () => {
    const id = generator.registerSpec(baseSpec);
    generator.generate(id);
    const result = generator.getGenerated(id);
    expect(result).toBeDefined();
    expect(result!.entityName).toBe('User');
  });

  it('FR-R172.3 미생성 이력 조회 undefined', () => {
    const id = generator.registerSpec(baseSpec);
    expect(generator.getGenerated(id)).toBeUndefined();
  });

  // FR-R172.4 보안 검사 (CSAP D-12)
  it('FR-R172.4 하드코딩 API 키 탐지', () => {
    const code = 'const key = "sk-abcdefghij1234567890"';
    const issues = generator.securityCheck(code);
    expect(issues).toContain('HARDCODED_API_KEY');
  });

  it('FR-R172.4 하드코딩 비밀번호 탐지', () => {
    const code = 'const password = "mySecret123"';
    const issues = generator.securityCheck(code);
    expect(issues).toContain('HARDCODED_PASSWORD');
  });

  it('FR-R172.4 안전한 코드 이슈 없음', () => {
    const code = 'const key = process.env.API_KEY';
    const issues = generator.securityCheck(code);
    expect(issues).toHaveLength(0);
  });

  // FR-R172.5 감사 로그
  it('FR-R172.5 감사 로그 기록', () => {
    const id = generator.registerSpec(baseSpec);
    generator.generate(id);
    const log = generator.getAuditLog();
    expect(log.some((e) => e.action === 'CODE_GENERATED')).toBe(true);
    expect(log.some((e) => e.tenantId === 'tenant-1')).toBe(true);
  });
});
