// MTU-N263 단위 테스트: API 자동 문서 생성 + AI 검색
// Design Ref: MTU-N263 DESIGN §1~§6
// CSAP: D-06 변경 감지, D-07 메트릭, D-12 개발 보안

import { describe, it, expect, beforeEach } from 'vitest';

import {
  OpenApiParser,
  ApiDocRenderer,
  CodeExampleGenerator,
  ApiDiffDetector,
  ApiSearchEngine,
  createApiDocTools,
  computeApiDocMetrics,
  type ApiServiceInfo,
  type ApiEndpoint,
} from '../../src/lib/api-doc-generator.js';

// -- 헬퍼 ──────────────────────────────────────────────────────────────────

function makeOpenApiSpec(): Record<string, unknown> {
  return {
    info: { title: 'Test API', version: '1.0.0', description: '테스트 API' },
    servers: [{ url: 'https://api.test.com' }],
    paths: {
      '/users': {
        get: {
          summary: '사용자 목록',
          description: '전체 사용자 목록 조회',
          tags: ['users'],
          parameters: [
            { name: 'page', in: 'query', description: '페이지 번호', required: false, schema: { type: 'integer' } },
          ],
          responses: { '200': { description: '성공' }, '401': { description: '인증 실패' } },
          security: [{ Bearer: [] }],
        },
        post: {
          summary: '사용자 생성',
          tags: ['users'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: '이름', example: '홍길동' },
                    email: { type: 'string', description: '이메일' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: '생성 완료' } },
        },
      },
      '/users/{id}': {
        get: {
          summary: '사용자 상세',
          tags: ['users'],
          parameters: [
            { name: 'id', in: 'path', description: '사용자 ID', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: '성공' }, '404': { description: '미발견' } },
          deprecated: true,
        },
      },
    },
  };
}

function makeServiceInfo(): ApiServiceInfo {
  const parser = new OpenApiParser();
  return parser.parse(makeOpenApiSpec());
}

// -- OpenApiParser -- Design §1 ─────────────────────────────────────────────

describe('OpenApiParser (FR-N263.1)', () => {
  let parser: OpenApiParser;

  beforeEach(() => {
    parser = new OpenApiParser();
  });

  it('OpenAPI 스펙을 파싱한다', () => {
    const service = parser.parse(makeOpenApiSpec());
    expect(service.name).toBe('Test API');
    expect(service.version).toBe('1.0.0');
    expect(service.baseUrl).toBe('https://api.test.com');
    expect(service.endpoints.length).toBe(3);
  });

  it('파라미터를 파싱한다', () => {
    const service = parser.parse(makeOpenApiSpec());
    const getUsersEndpoint = service.endpoints.find((e) => e.path === '/users' && e.method === 'GET');
    expect(getUsersEndpoint!.parameters).toHaveLength(1);
    expect(getUsersEndpoint!.parameters[0]!.name).toBe('page');
    expect(getUsersEndpoint!.parameters[0]!.in).toBe('query');
  });

  it('requestBody를 파싱한다', () => {
    const service = parser.parse(makeOpenApiSpec());
    const postUsers = service.endpoints.find((e) => e.path === '/users' && e.method === 'POST');
    expect(postUsers!.requestBody).toBeDefined();
    expect(postUsers!.requestBody!.properties['name']).toBeDefined();
    expect(postUsers!.requestBody!.properties['name']!.type).toBe('string');
  });

  it('응답을 파싱한다', () => {
    const service = parser.parse(makeOpenApiSpec());
    const getUsersEndpoint = service.endpoints.find((e) => e.path === '/users' && e.method === 'GET');
    expect(getUsersEndpoint!.responses['200']).toBeDefined();
    expect(getUsersEndpoint!.responses['401']).toBeDefined();
  });

  it('보안 설정을 파싱한다', () => {
    const service = parser.parse(makeOpenApiSpec());
    const getUsersEndpoint = service.endpoints.find((e) => e.path === '/users' && e.method === 'GET');
    expect(getUsersEndpoint!.security).toContain('Bearer');
  });

  it('deprecated 플래그를 파싱한다', () => {
    const service = parser.parse(makeOpenApiSpec());
    const deprecated = service.endpoints.find((e) => e.deprecated);
    expect(deprecated).toBeDefined();
    expect(deprecated!.path).toBe('/users/{id}');
  });

  it('빈 스펙을 파싱한다', () => {
    const service = parser.parse({});
    expect(service.name).toBe('Unknown Service');
    expect(service.endpoints).toHaveLength(0);
  });
});

// -- ApiDocRenderer -- Design §2 ──────────────────────────────────────────

describe('ApiDocRenderer (FR-N263.2)', () => {
  it('마크다운 문서를 생성한다', () => {
    const renderer = new ApiDocRenderer();
    const service = makeServiceInfo();
    const md = renderer.render(service);

    expect(md).toContain('# Test API API 문서');
    expect(md).toContain('버전: 1.0.0');
    expect(md).toContain('## users');
    expect(md).toContain('`GET` /users');
    expect(md).toContain('`POST` /users');
    expect(md).toContain('[DEPRECATED]');
    expect(md).toContain('| 이름 | 위치 |');
  });
});

// -- CodeExampleGenerator -- Design §5 ──────────────────────────────────────

describe('CodeExampleGenerator (FR-N263.5)', () => {
  let codeGen: CodeExampleGenerator;
  let service: ApiServiceInfo;

  beforeEach(() => {
    codeGen = new CodeExampleGenerator();
    service = makeServiceInfo();
  });

  it('curl 예제를 생성한다 (GET)', () => {
    const getEndpoint = service.endpoints.find((e) => e.method === 'GET' && e.path === '/users')!;
    const curl = codeGen.generateCurl(getEndpoint, 'https://api.test.com');
    expect(curl).toContain('curl -X GET');
    expect(curl).toContain('https://api.test.com/users');
  });

  it('curl 예제를 생성한다 (POST, body)', () => {
    const postEndpoint = service.endpoints.find((e) => e.method === 'POST')!;
    const curl = codeGen.generateCurl(postEndpoint, 'https://api.test.com');
    expect(curl).toContain('curl -X POST');
    expect(curl).toContain('-d');
    expect(curl).toContain('Content-Type: application/json');
  });

  it('JavaScript (fetch) 예제를 생성한다', () => {
    const getEndpoint = service.endpoints.find((e) => e.method === 'GET' && e.path === '/users')!;
    const js = codeGen.generateJavaScript(getEndpoint, 'https://api.test.com');
    expect(js).toContain("fetch('https://api.test.com/users'");
    expect(js).toContain("method: 'GET'");
  });

  it('POST body가 포함된 JavaScript 예제', () => {
    const postEndpoint = service.endpoints.find((e) => e.method === 'POST')!;
    const js = codeGen.generateJavaScript(postEndpoint, 'https://api.test.com');
    expect(js).toContain('JSON.stringify');
    expect(js).toContain('Content-Type');
  });
});

// -- ApiDiffDetector -- Design §4 ──────────────────────────────────────────

describe('ApiDiffDetector (FR-N263.4)', () => {
  let detector: ApiDiffDetector;

  beforeEach(() => {
    detector = new ApiDiffDetector();
  });

  it('추가된 엔드포인트를 감지한다', () => {
    const previous = makeServiceInfo();
    const current = makeServiceInfo();
    // 현재에 새 엔드포인트 추가
    current.endpoints.push({
      id: 'new-1',
      path: '/health',
      method: 'GET',
      summary: '헬스체크',
      description: '',
      tags: [],
      parameters: [],
      responses: {},
      security: [],
      deprecated: false,
    });

    const diffs = detector.diff(previous, current);
    expect(diffs.some((d) => d.type === 'added' && d.path === '/health')).toBe(true);
  });

  it('삭제된 엔드포인트를 감지한다', () => {
    const previous = makeServiceInfo();
    const current = makeServiceInfo();
    current.endpoints = current.endpoints.filter((e) => !(e.path === '/users/{id}'));

    const diffs = detector.diff(previous, current);
    expect(diffs.some((d) => d.type === 'removed' && d.path === '/users/{id}')).toBe(true);
  });

  it('deprecated 변경을 감지한다', () => {
    const previous = makeServiceInfo();
    // deprecated=false인 것을 찾아서 previous에 반영
    const getUsers = previous.endpoints.find((e) => e.path === '/users' && e.method === 'GET');
    if (getUsers) getUsers.deprecated = false;

    const current = makeServiceInfo();
    const getUsersCurrent = current.endpoints.find((e) => e.path === '/users' && e.method === 'GET');
    if (getUsersCurrent) getUsersCurrent.deprecated = true;

    const diffs = detector.diff(previous, current);
    expect(diffs.some((d) => d.type === 'deprecated')).toBe(true);
  });

  it('동일 스펙이면 빈 diff', () => {
    const service = makeServiceInfo();
    const diffs = detector.diff(service, service);
    expect(diffs).toHaveLength(0);
  });
});

// -- ApiSearchEngine -- Design §3 ──────────────────────────────────────────

describe('ApiSearchEngine (FR-N263.3)', () => {
  let engine: ApiSearchEngine;

  beforeEach(() => {
    engine = new ApiSearchEngine();
    engine.index(makeServiceInfo());
  });

  it('키워드로 검색한다', () => {
    const results = engine.search('사용자 목록');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('관련성 순으로 정렬한다', () => {
    const results = engine.search('사용자 목록 조회');
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.relevanceScore).toBeLessThanOrEqual(results[i - 1]!.relevanceScore);
    }
  });

  it('매칭 없으면 빈 배열', () => {
    const results = engine.search('zzzxxxyyy');
    expect(results).toHaveLength(0);
  });

  it('서비스를 중복 인덱싱하면 업데이트', () => {
    engine.index(makeServiceInfo());
    expect(engine.getServiceCount()).toBe(1); // 동일 이름이므로 교체
  });

  it('서비스 수/엔드포인트 수를 반환한다', () => {
    expect(engine.getServiceCount()).toBe(1);
    expect(engine.getTotalEndpoints()).toBe(3);
  });
});

// -- computeApiDocMetrics -- Design §6 ──────────────────────────────────────

describe('computeApiDocMetrics (FR-N263.6)', () => {
  it('문서 메트릭을 계산한다', () => {
    const service = makeServiceInfo();
    const metrics = computeApiDocMetrics(service);
    expect(metrics.totalEndpoints).toBe(3);
    expect(metrics.documentedEndpoints).toBeGreaterThan(0);
    expect(metrics.documentationCoverage).toBeGreaterThan(0);
    expect(metrics.deprecatedCount).toBe(1);
  });

  it('빈 서비스의 메트릭', () => {
    const metrics = computeApiDocMetrics({
      name: 'Empty',
      version: '1.0',
      description: '',
      baseUrl: '/',
      endpoints: [],
      lastUpdated: new Date().toISOString(),
    });
    expect(metrics.totalEndpoints).toBe(0);
    expect(metrics.documentationCoverage).toBe(100);
  });
});

// -- createApiDocTools 팩토리 ──────────────────────────────────────────────

describe('createApiDocTools 팩토리', () => {
  it('모든 도구를 생성한다', () => {
    const tools = createApiDocTools();
    expect(tools.parser).toBeInstanceOf(OpenApiParser);
    expect(tools.renderer).toBeInstanceOf(ApiDocRenderer);
    expect(tools.codeGen).toBeInstanceOf(CodeExampleGenerator);
    expect(tools.diffDetector).toBeInstanceOf(ApiDiffDetector);
    expect(tools.searchEngine).toBeInstanceOf(ApiSearchEngine);
  });
});
