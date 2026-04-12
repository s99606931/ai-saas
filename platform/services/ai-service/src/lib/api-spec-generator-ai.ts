// Design Ref: §R173 AI기반API스펙자동생성
// Plan SC: FR-R173.1~5

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface EndpointSpec {
  path: string;
  method: HttpMethod;
  summary: string;
  requestBody?: Record<string, { type: string; required: boolean }>;
  responseSchema?: Record<string, string>;
  security: 'public' | 'bearer' | 'rbac';
  tags?: string[];
}

export interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, object>>;
  generatedAt: string;
}

export interface AuditEntry {
  action: string;
  timestamp: string;
  detail?: string;
}

export class ApiSpecGeneratorAi {
  private endpoints: EndpointSpec[] = [];
  private auditLog: AuditEntry[] = [];

  // FR-R173.1 엔드포인트 등록
  addEndpoint(endpoint: EndpointSpec): void {
    this.endpoints.push({ ...endpoint });
    this.auditLog.push({ action: 'ENDPOINT_ADDED', timestamp: new Date().toISOString(), detail: `${endpoint.method} ${endpoint.path}` });
  }

  // FR-R173.2 OpenAPI 3.0 스펙 생성
  generateOpenApi(title: string, version: string): OpenApiSpec {
    const paths: Record<string, Record<string, object>> = {};

    for (const ep of this.endpoints) {
      if (!paths[ep.path]) paths[ep.path] = {};
      const methodKey = ep.method.toLowerCase();

      const securityScheme = ep.security === 'public'
        ? []
        : ep.security === 'rbac'
        ? [{ bearerAuth: [], rbac: [] }]
        : [{ bearerAuth: [] }];

      paths[ep.path]![methodKey] = {
        summary: ep.summary,
        tags: ep.tags ?? [],
        security: securityScheme,
        requestBody: ep.requestBody
          ? {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: Object.fromEntries(
                      Object.entries(ep.requestBody).map(([k, v]) => [k, { type: v.type }])
                    ),
                    required: Object.entries(ep.requestBody)
                      .filter(([, v]) => v.required)
                      .map(([k]) => k),
                  },
                },
              },
            }
          : undefined,
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: ep.responseSchema ?? { type: 'object' } } } },
          '400': { description: '입력 오류' },
          '401': { description: '인증 실패' },
          '403': { description: '권한 없음' },
        },
      };
    }

    this.auditLog.push({ action: 'SPEC_GENERATED', timestamp: new Date().toISOString() });
    return { openapi: '3.0.3', info: { title, version }, paths, generatedAt: new Date().toISOString() };
  }

  // FR-R173.3 CSAP D-08 준수 검사 (인증 없는 비공개 엔드포인트 탐지)
  validateSecurity(): string[] {
    const issues: string[] = [];
    for (const ep of this.endpoints) {
      if (ep.security !== 'public' && ep.path.includes('/admin')) {
        if (ep.security !== 'rbac') {
          issues.push(`${ep.method} ${ep.path}: 관리자 경로에 RBAC 필요 (CSAP D-08)`);
        }
      }
    }
    return issues;
  }

  // FR-R173.4 중복 경로 감지
  getDuplicates(): string[] {
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const ep of this.endpoints) {
      const key = `${ep.method}:${ep.path}`;
      if (seen.has(key)) dups.push(key);
      else seen.add(key);
    }
    return dups;
  }

  // FR-R173.5 감사 로그 (CSAP D-06)
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  listEndpoints(): EndpointSpec[] {
    return [...this.endpoints];
  }
}
