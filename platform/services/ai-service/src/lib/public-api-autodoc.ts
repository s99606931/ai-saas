/**
 * 공공 API 자동 문서화 — SVC-AI-ADV-R125
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R125/SVC-AI-ADV-R125.design.md
 * Plan SC: FR-R125.1 ~ FR-R125.6
 *
 * 공공기관 API 엔드포인트 자동 문서화 (OpenAPI 3.1 형식).
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required: boolean
  schema: { type: string; example?: unknown }
  description?: string
}

export interface ApiRequestBody {
  contentType: string
  schema: Record<string, unknown>
  example?: unknown
}

export interface ApiResponse {
  statusCode: number
  description: string
  schema?: Record<string, unknown>
}

export interface EndpointSpec {
  path: string
  method: HttpMethod
  summary: string
  description?: string
  tags: string[]
  parameters?: ApiParameter[]
  requestBody?: ApiRequestBody
  responses: ApiResponse[]
  security?: string[]
  grade: DataGrade
}

export interface OpenApiDocument {
  openapi: '3.1.0'
  info: { title: string; version: string; description: string }
  paths: Record<string, Record<string, unknown>>
  components: { securitySchemes: Record<string, unknown> }
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

export class PublicApiAutodoc {
  private readonly endpoints = new Map<string, EndpointSpec>()
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog
  }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  private endpointKey(path: string, method: HttpMethod): string {
    return `${method}:${path}`
  }

  // Plan SC: FR-R125.1
  registerEndpoint(spec: EndpointSpec): void {
    if (spec.grade === DataGrade.C || spec.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${spec.grade}등급 API 문서화 금지 (N2SF N-05)`)
    }
    this.endpoints.set(this.endpointKey(spec.path, spec.method), spec)
    this.audit('registerEndpoint', { path: spec.path, method: spec.method })
  }

  // Plan SC: FR-R125.2 — build parameter object for OpenAPI
  private buildParameter(p: ApiParameter): Record<string, unknown> {
    return {
      name: p.name,
      in: p.in,
      required: p.required,
      schema: p.schema,
      ...(p.description ? { description: p.description } : {}),
    }
  }

  // Plan SC: FR-R125.3 — build responses object
  private buildResponses(responses: ApiResponse[]): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const r of responses) {
      result[String(r.statusCode)] = {
        description: r.description,
        ...(r.schema ? { content: { 'application/json': { schema: r.schema } } } : {}),
      }
    }
    return result
  }

  // Plan SC: FR-R125.4 — build path item operation
  private buildOperation(spec: EndpointSpec): Record<string, unknown> {
    const op: Record<string, unknown> = {
      summary: spec.summary,
      tags: spec.tags,
      responses: this.buildResponses(spec.responses),
    }
    if (spec.description) op['description'] = spec.description
    if (spec.parameters && spec.parameters.length > 0) {
      op['parameters'] = spec.parameters.map(p => this.buildParameter(p))
    }
    if (spec.requestBody) {
      op['requestBody'] = {
        required: true,
        content: { [spec.requestBody.contentType]: { schema: spec.requestBody.schema } },
      }
    }
    if (spec.security && spec.security.length > 0) {
      op['security'] = spec.security.map(s => ({ [s]: [] }))
    }
    return op
  }

  // Plan SC: FR-R125.5, FR-R125.6
  generateOpenApi(title: string, version: string, description = ''): OpenApiDocument {
    const paths: Record<string, Record<string, unknown>> = {}
    for (const spec of this.endpoints.values()) {
      if (!paths[spec.path]) paths[spec.path] = {}
      paths[spec.path]![spec.method.toLowerCase()] = this.buildOperation(spec)
    }
    this.audit('generateOpenApi', { title, endpoints: this.endpoints.size })
    return {
      openapi: '3.1.0',
      info: { title, version, description },
      paths,
      components: {
        securitySchemes: {
          BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    }
  }

  listEndpoints(): EndpointSpec[] {
    return [...this.endpoints.values()]
  }
}
