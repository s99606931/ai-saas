import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGeneratorService, type ServiceSpec } from '../code-generator-service';

describe('CodeGeneratorService', () => {
  let svc: CodeGeneratorService;

  const spec: ServiceSpec = {
    name: 'user-service',
    routes: [
      { method: 'GET', path: '/users', handler: 'listUsers' },
      { method: 'POST', path: '/users', handler: 'createUser' },
    ],
    models: [{ name: 'User', fields: { id: 'string', name: 'string' } }],
  };

  beforeEach(() => {
    svc = new CodeGeneratorService();
    svc.registerTemplate({ id: 'fastify-basic', name: 'Fastify Basic', framework: 'fastify', files: ['index.ts'] });
  });

  it('FR-CG.1 템플릿 카탈로그', () => {
    expect(svc.listTemplates().length).toBe(1);
  });

  it('FR-CG.2 스켈레톤 생성', () => {
    const out = svc.generateFromSpec(spec, 'fastify-basic');
    expect(out.length).toBe(4);
    expect(out.find((a) => a.path === 'src/routes.ts')?.content).toContain('users');
  });

  it('FR-CG.3 라우트/모델', () => {
    const out = svc.generateFromSpec(spec, 'fastify-basic');
    expect(out.find((a) => a.path === 'src/models.ts')?.content).toContain('interface User');
  });

  it('FR-CG.4 테스트 뼈대', () => {
    const out = svc.generateFromSpec(spec, 'fastify-basic');
    expect(out.find((a) => a.path.includes('smoke.test'))?.content).toContain('vitest');
  });

  it('FR-CG.5 품질 게이트', () => {
    const out = svc.generateFromSpec(spec, 'fastify-basic');
    const report = svc.runQualityGate(out);
    expect(report.passes).toBe(true);
  });
});
