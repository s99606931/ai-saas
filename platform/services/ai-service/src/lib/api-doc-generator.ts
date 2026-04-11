// API 자동 문서 생성 + AI 검색 -- FR-N263.1~FR-N263.6
// Design Ref: MTU-N263 DESIGN §1~§6
// CSAP: D-06 변경 감지, D-07 메트릭, D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** HTTP 메서드 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** API 엔드포인트 정보 -- Design §1 */
export interface ApiEndpoint {
  id: string;
  path: string;
  method: HttpMethod;
  summary: string;
  description: string;
  tags: string[];
  parameters: ApiParameter[];
  requestBody?: ApiSchema;
  responses: Record<string, ApiResponse>;
  security: string[];
  deprecated: boolean;
}

/** API 파라미터 */
export interface ApiParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description: string;
  required: boolean;
  type: string;
  example?: string;
}

/** API 스키마 */
export interface ApiSchema {
  type: string;
  properties: Record<string, {
    type: string;
    description: string;
    required: boolean;
    example?: unknown;
  }>;
}

/** API 응답 */
export interface ApiResponse {
  statusCode: string;
  description: string;
  schema?: ApiSchema;
}

/** API 서비스 정보 */
export interface ApiServiceInfo {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  endpoints: ApiEndpoint[];
  lastUpdated: string;
}

/** API 변경 사항 -- Design §4 */
export interface ApiDiffEntry {
  type: 'added' | 'modified' | 'removed' | 'deprecated';
  path: string;
  method: HttpMethod;
  description: string;
  details?: string;
}

/** API 문서 메트릭 -- Design §6 */
export interface ApiDocMetrics {
  totalEndpoints: number;
  documentedEndpoints: number;
  documentationCoverage: number;
  descriptionRate: number;
  exampleRate: number;
  deprecatedCount: number;
  lastUpdated: string;
}

/** AI 검색 결과 -- Design §3 */
export interface ApiSearchResult {
  endpoint: ApiEndpoint;
  serviceName: string;
  relevanceScore: number;
  matchedKeywords: string[];
}

// -- OpenAPI 파서 -- Design §1 ──────────────────────────────────────────────

/** OpenAPI 스펙 파서 */
export class OpenApiParser {
  /** OpenAPI JSON 스펙을 구조화된 엔드포인트 목록으로 변환 */
  parse(spec: Record<string, unknown>): ApiServiceInfo {
    const info = (spec['info'] as Record<string, unknown>) || {};
    const paths = (spec['paths'] as Record<string, unknown>) || {};
    const endpoints: ApiEndpoint[] = [];

    for (const [path, methods] of Object.entries(paths)) {
      if (typeof methods !== 'object' || methods === null) continue;

      for (const [method, operation] of Object.entries(methods as Record<string, unknown>)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;

        const op = operation as Record<string, unknown>;
        const endpoint: ApiEndpoint = {
          id: randomUUID(),
          path,
          method: method.toUpperCase() as HttpMethod,
          summary: String(op['summary'] || ''),
          description: String(op['description'] || ''),
          tags: (op['tags'] as string[]) || [],
          parameters: this.parseParameters(op['parameters'] as unknown[] || []),
          requestBody: this.parseRequestBody(op['requestBody'] as Record<string, unknown>),
          responses: this.parseResponses(op['responses'] as Record<string, unknown> || {}),
          security: this.parseSecurity(op['security'] as unknown[]),
          deprecated: Boolean(op['deprecated']),
        };
        endpoints.push(endpoint);
      }
    }

    return {
      name: String(info['title'] || 'Unknown Service'),
      version: String(info['version'] || '1.0.0'),
      description: String(info['description'] || ''),
      baseUrl: this.extractBaseUrl(spec),
      endpoints,
      lastUpdated: new Date().toISOString(),
    };
  }

  private parseParameters(params: unknown[]): ApiParameter[] {
    return params.map((p) => {
      const param = p as Record<string, unknown>;
      return {
        name: String(param['name'] || ''),
        in: String(param['in'] || 'query') as ApiParameter['in'],
        description: String(param['description'] || ''),
        required: Boolean(param['required']),
        type: String((param['schema'] as Record<string, unknown>)?.['type'] || 'string'),
        example: param['example'] ? String(param['example']) : undefined,
      };
    });
  }

  private parseRequestBody(body?: Record<string, unknown>): ApiSchema | undefined {
    if (!body) return undefined;
    const content = body['content'] as Record<string, unknown>;
    if (!content) return undefined;
    const jsonContent = content['application/json'] as Record<string, unknown>;
    if (!jsonContent) return undefined;
    const schema = jsonContent['schema'] as Record<string, unknown>;
    if (!schema) return undefined;
    return {
      type: String(schema['type'] || 'object'),
      properties: this.extractProperties(schema['properties'] as Record<string, unknown>),
    };
  }

  private extractProperties(
    props?: Record<string, unknown>,
  ): Record<string, { type: string; description: string; required: boolean; example?: unknown }> {
    if (!props) return {};
    const result: Record<string, { type: string; description: string; required: boolean; example?: unknown }> = {};
    for (const [name, value] of Object.entries(props)) {
      const prop = value as Record<string, unknown>;
      result[name] = {
        type: String(prop['type'] || 'string'),
        description: String(prop['description'] || ''),
        required: false,
        example: prop['example'],
      };
    }
    return result;
  }

  private parseResponses(responses: Record<string, unknown>): Record<string, ApiResponse> {
    const result: Record<string, ApiResponse> = {};
    for (const [status, value] of Object.entries(responses)) {
      const resp = value as Record<string, unknown>;
      result[status] = {
        statusCode: status,
        description: String(resp['description'] || ''),
      };
    }
    return result;
  }

  private parseSecurity(security?: unknown[]): string[] {
    if (!security) return [];
    const result: string[] = [];
    for (const item of security) {
      if (typeof item === 'object' && item !== null) {
        result.push(...Object.keys(item));
      }
    }
    return result;
  }

  private extractBaseUrl(spec: Record<string, unknown>): string {
    const servers = spec['servers'] as Array<Record<string, unknown>>;
    const firstServer = servers && servers.length > 0 ? servers[0] : undefined;
    return firstServer ? String(firstServer['url'] || '/') : '/';
  }
}

// -- 마크다운 문서 생성 -- Design §2 ─────────────────────────────────────────

/** API 마크다운 문서 생성기 */
export class ApiDocRenderer {
  /** 서비스 전체 문서 생성 */
  render(service: ApiServiceInfo): string {
    const lines: string[] = [];

    lines.push(`# ${service.name} API 문서`);
    lines.push('');
    lines.push(`> 버전: ${service.version} | 기준 URL: ${service.baseUrl}`);
    lines.push(`> 최종 갱신: ${service.lastUpdated}`);
    lines.push('');
    lines.push(service.description);
    lines.push('');
    lines.push('---');
    lines.push('');

    // 태그별 그룹핑
    const tagGroups = this.groupByTags(service.endpoints);

    for (const [tag, endpoints] of Object.entries(tagGroups)) {
      lines.push(`## ${tag}`);
      lines.push('');

      for (const endpoint of endpoints) {
        lines.push(this.renderEndpoint(endpoint));
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /** 단일 엔드포인트 렌더링 */
  private renderEndpoint(endpoint: ApiEndpoint): string {
    const lines: string[] = [];
    const badge = endpoint.deprecated ? ' [DEPRECATED]' : '';

    lines.push(`### \`${endpoint.method}\` ${endpoint.path}${badge}`);
    lines.push('');
    if (endpoint.summary) lines.push(`**${endpoint.summary}**`);
    if (endpoint.description) lines.push(`\n${endpoint.description}`);
    lines.push('');

    // 파라미터
    if (endpoint.parameters.length > 0) {
      lines.push('#### 파라미터');
      lines.push('');
      lines.push('| 이름 | 위치 | 타입 | 필수 | 설명 |');
      lines.push('|------|------|------|------|------|');
      for (const param of endpoint.parameters) {
        lines.push(`| ${param.name} | ${param.in} | ${param.type} | ${param.required ? 'Y' : 'N'} | ${param.description} |`);
      }
      lines.push('');
    }

    // 요청 바디
    if (endpoint.requestBody) {
      lines.push('#### 요청 바디');
      lines.push('');
      lines.push('| 필드 | 타입 | 설명 |');
      lines.push('|------|------|------|');
      for (const [name, prop] of Object.entries(endpoint.requestBody.properties)) {
        lines.push(`| ${name} | ${prop.type} | ${prop.description} |`);
      }
      lines.push('');
    }

    // 응답
    if (Object.keys(endpoint.responses).length > 0) {
      lines.push('#### 응답');
      lines.push('');
      for (const [status, response] of Object.entries(endpoint.responses)) {
        lines.push(`- **${status}**: ${response.description}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private groupByTags(endpoints: ApiEndpoint[]): Record<string, ApiEndpoint[]> {
    const groups: Record<string, ApiEndpoint[]> = {};
    for (const endpoint of endpoints) {
      const tag = endpoint.tags[0] || '기타';
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(endpoint);
    }
    return groups;
  }
}

// -- 코드 예제 생성 -- Design §5 ────────────────────────────────────────────

/** API 코드 예제 생성기 */
export class CodeExampleGenerator {
  /** curl 예제 생성 */
  generateCurl(endpoint: ApiEndpoint, baseUrl: string): string {
    const url = `${baseUrl}${endpoint.path}`;
    let cmd = `curl -X ${endpoint.method} "${url}"`;

    if (endpoint.requestBody) {
      const body: Record<string, unknown> = {};
      for (const [name, prop] of Object.entries(endpoint.requestBody.properties)) {
        body[name] = prop.example ?? `<${prop.type}>`;
      }
      cmd += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body, null, 2)}'`;
    }

    return cmd;
  }

  /** JavaScript (fetch) 예제 생성 */
  generateJavaScript(endpoint: ApiEndpoint, baseUrl: string): string {
    const url = `${baseUrl}${endpoint.path}`;
    const lines: string[] = [];

    lines.push(`const response = await fetch('${url}', {`);
    lines.push(`  method: '${endpoint.method}',`);

    if (endpoint.requestBody) {
      lines.push(`  headers: { 'Content-Type': 'application/json' },`);
      const body: Record<string, string> = {};
      for (const [name, prop] of Object.entries(endpoint.requestBody.properties)) {
        body[name] = String(prop.example ?? `<${prop.type}>`);
      }
      lines.push(`  body: JSON.stringify(${JSON.stringify(body, null, 4)}),`);
    }

    lines.push('});');
    lines.push('const data = await response.json();');

    return lines.join('\n');
  }
}

// -- API 변경 감지 -- Design §4 ──────────────────────────────────────────────

/** API 변경 감지기 */
export class ApiDiffDetector {
  /** 두 버전의 API 스펙 비교 */
  diff(previous: ApiServiceInfo, current: ApiServiceInfo): ApiDiffEntry[] {
    const diffs: ApiDiffEntry[] = [];

    const prevMap = new Map(previous.endpoints.map((e) => [`${e.method}:${e.path}`, e]));
    const currMap = new Map(current.endpoints.map((e) => [`${e.method}:${e.path}`, e]));

    // 추가된 엔드포인트
    for (const [key, endpoint] of currMap) {
      if (!prevMap.has(key)) {
        diffs.push({
          type: 'added',
          path: endpoint.path,
          method: endpoint.method,
          description: `신규 엔드포인트: ${endpoint.summary}`,
        });
      }
    }

    // 삭제된 엔드포인트
    for (const [key, endpoint] of prevMap) {
      if (!currMap.has(key)) {
        diffs.push({
          type: 'removed',
          path: endpoint.path,
          method: endpoint.method,
          description: `제거된 엔드포인트: ${endpoint.summary}`,
        });
      }
    }

    // 변경된 엔드포인트
    for (const [key, currEndpoint] of currMap) {
      const prevEndpoint = prevMap.get(key);
      if (prevEndpoint) {
        if (currEndpoint.deprecated && !prevEndpoint.deprecated) {
          diffs.push({
            type: 'deprecated',
            path: currEndpoint.path,
            method: currEndpoint.method,
            description: `사용 중단 예정: ${currEndpoint.summary}`,
          });
        } else if (currEndpoint.summary !== prevEndpoint.summary || currEndpoint.description !== prevEndpoint.description) {
          diffs.push({
            type: 'modified',
            path: currEndpoint.path,
            method: currEndpoint.method,
            description: `설명 변경: ${currEndpoint.summary}`,
          });
        }
      }
    }

    return diffs;
  }
}

// -- AI API 검색 -- Design §3 ────────────────────────────────────────────────

/** AI 기반 자연어 API 검색 */
export class ApiSearchEngine {
  private services: ApiServiceInfo[] = [];

  /** 서비스 인덱싱 */
  index(service: ApiServiceInfo): void {
    const existing = this.services.findIndex((s) => s.name === service.name);
    if (existing >= 0) {
      this.services[existing] = service;
    } else {
      this.services.push(service);
    }
  }

  /** 자연어 검색 */
  search(query: string, limit = 10): ApiSearchResult[] {
    const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    const results: ApiSearchResult[] = [];

    for (const service of this.services) {
      for (const endpoint of service.endpoints) {
        const searchText = `${endpoint.summary} ${endpoint.description} ${endpoint.path} ${endpoint.tags.join(' ')}`.toLowerCase();
        const matchedKeywords = queryTokens.filter((token) => searchText.includes(token));

        if (matchedKeywords.length > 0) {
          const relevanceScore = Math.round((matchedKeywords.length / queryTokens.length) * 100) / 100;
          results.push({
            endpoint,
            serviceName: service.name,
            relevanceScore,
            matchedKeywords,
          });
        }
      }
    }

    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /** 등록된 서비스 수 */
  getServiceCount(): number {
    return this.services.length;
  }

  /** 전체 엔드포인트 수 */
  getTotalEndpoints(): number {
    return this.services.reduce((sum, s) => sum + s.endpoints.length, 0);
  }
}

// -- 메트릭 -- Design §6 ────────────────────────────────────────────────────

/** API 문서 메트릭 계산 */
export function computeApiDocMetrics(service: ApiServiceInfo): ApiDocMetrics {
  const total = service.endpoints.length;
  const documented = service.endpoints.filter(
    (e) => e.description.length > 0 || e.summary.length > 0,
  ).length;
  const hasExamples = service.endpoints.filter(
    (e) => e.parameters.some((p) => p.example != null) ||
      (e.requestBody && Object.values(e.requestBody.properties).some((p) => p.example != null)),
  ).length;
  const deprecated = service.endpoints.filter((e) => e.deprecated).length;

  return {
    totalEndpoints: total,
    documentedEndpoints: documented,
    documentationCoverage: total > 0 ? Math.round((documented / total) * 100) : 100,
    descriptionRate: total > 0 ? Math.round((documented / total) * 100) : 100,
    exampleRate: total > 0 ? Math.round((hasExamples / total) * 100) : 0,
    deprecatedCount: deprecated,
    lastUpdated: service.lastUpdated,
  };
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

/** API 문서 도구 생성 */
export function createApiDocTools(): {
  parser: OpenApiParser;
  renderer: ApiDocRenderer;
  codeGen: CodeExampleGenerator;
  diffDetector: ApiDiffDetector;
  searchEngine: ApiSearchEngine;
} {
  return {
    parser: new OpenApiParser(),
    renderer: new ApiDocRenderer(),
    codeGen: new CodeExampleGenerator(),
    diffDetector: new ApiDiffDetector(),
    searchEngine: new ApiSearchEngine(),
  };
}
