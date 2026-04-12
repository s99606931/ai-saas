import { describe, it, expect, beforeEach } from 'vitest';
import { GoldenPathEngine } from '../golden-path-engine.js';

describe('GoldenPathEngine', () => {
  let engine: GoldenPathEngine;

  beforeEach(() => {
    engine = new GoldenPathEngine();
    engine.register({
      id: 'svc-ts',
      name: 'TypeScript 서비스',
      description: '기본 서비스 스캐폴드',
      category: 'backend',
      variables: [
        { name: 'serviceName', type: 'string', required: true, pattern: '^[a-z-]+$' },
        { name: 'port', type: 'number', required: false, defaultValue: 3000 },
        { name: 'runtime', type: 'enum', required: true, enumValues: ['node', 'bun'] },
      ],
      files: [
        { path: '{{serviceName}}/package.json', content: '{"name":"{{serviceName}}"}' },
        { path: '{{serviceName}}/index.ts', content: 'console.log({{port}})' },
      ],
      postSteps: ['pnpm install', 'pnpm dev --port {{port}}'],
    });
  });

  it('정상 렌더', () => {
    const r = engine.render('svc-ts', { serviceName: 'user-api', runtime: 'node' });
    expect(r.files[0]?.path).toBe('user-api/package.json');
    expect(r.files[1]?.content).toContain('3000');
  });

  it('패턴 불일치 거부', () => {
    expect(() => engine.render('svc-ts', { serviceName: 'UserAPI', runtime: 'node' })).toThrow('PATTERN_MISMATCH');
  });

  it('enum 검증', () => {
    expect(() => engine.render('svc-ts', { serviceName: 'a', runtime: 'deno' })).toThrow('INVALID_ENUM');
  });

  it('필수 변수 누락', () => {
    expect(() => engine.render('svc-ts', { runtime: 'node' })).toThrow('MISSING_VAR');
  });

  it('카탈로그 조회', () => {
    expect(engine.list('backend')).toHaveLength(1);
    expect(engine.list('frontend')).toHaveLength(0);
  });
});
