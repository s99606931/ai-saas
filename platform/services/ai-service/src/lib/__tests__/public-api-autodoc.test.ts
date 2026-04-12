/**
 * Unit tests for Public API Autodoc — SVC-AI-ADV-R125
 */
import { describe, it, expect } from 'vitest'
import { PublicApiAutodoc, DataGrade } from '../public-api-autodoc'

const makeSpec = (overrides = {}) => ({
  path: '/api/v1/notices',
  method: 'GET' as const,
  summary: '공지사항 목록 조회',
  tags: ['notices'],
  parameters: [{ name: 'page', in: 'query' as const, required: false, schema: { type: 'integer', example: 1 } }],
  responses: [{ statusCode: 200, description: 'Success', schema: { type: 'object' } }],
  grade: DataGrade.O,
  ...overrides,
})

describe('SVC-AI-ADV-R125 PublicApiAutodoc', () => {
  it('[FR-R125.1] registers endpoint', () => {
    const doc = new PublicApiAutodoc()
    doc.registerEndpoint(makeSpec())
    expect(doc.listEndpoints()).toHaveLength(1)
  })

  it('[FR-R125.1] blocks C/S grade endpoints', () => {
    const doc = new PublicApiAutodoc()
    expect(() => doc.registerEndpoint(makeSpec({ grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => doc.registerEndpoint(makeSpec({ grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R125.5] generateOpenApi produces openapi 3.1.0 document', () => {
    const doc = new PublicApiAutodoc()
    doc.registerEndpoint(makeSpec())
    const openapi = doc.generateOpenApi('공공기관 API', '1.0.0')
    expect(openapi.openapi).toBe('3.1.0')
    expect(openapi.info.title).toBe('공공기관 API')
  })

  it('[FR-R125.6] path appears in generated document', () => {
    const doc = new PublicApiAutodoc()
    doc.registerEndpoint(makeSpec())
    const openapi = doc.generateOpenApi('Test', '1.0.0')
    expect(openapi.paths['/api/v1/notices']).toBeDefined()
    expect(openapi.paths['/api/v1/notices']!['get']).toBeDefined()
  })

  it('parameters included in generated operation', () => {
    const doc = new PublicApiAutodoc()
    doc.registerEndpoint(makeSpec())
    const openapi = doc.generateOpenApi('Test', '1.0.0')
    const operation = openapi.paths['/api/v1/notices']!['get'] as Record<string, unknown>
    expect(Array.isArray(operation['parameters'])).toBe(true)
  })

  it('POST with requestBody included', () => {
    const doc = new PublicApiAutodoc()
    doc.registerEndpoint(makeSpec({
      path: '/api/v1/notices',
      method: 'POST',
      requestBody: { contentType: 'application/json', schema: { type: 'object' } },
    }))
    const openapi = doc.generateOpenApi('Test', '1.0.0')
    const operation = openapi.paths['/api/v1/notices']!['post'] as Record<string, unknown>
    expect(operation['requestBody']).toBeDefined()
  })

  it('multiple endpoints in same path produce separate methods', () => {
    const doc = new PublicApiAutodoc()
    doc.registerEndpoint(makeSpec({ method: 'GET' }))
    doc.registerEndpoint(makeSpec({ method: 'POST', requestBody: { contentType: 'application/json', schema: {} } }))
    const openapi = doc.generateOpenApi('Test', '1.0.0')
    expect(openapi.paths['/api/v1/notices']!['get']).toBeDefined()
    expect(openapi.paths['/api/v1/notices']!['post']).toBeDefined()
  })

  it('audit log records register and generate', () => {
    const doc = new PublicApiAutodoc()
    doc.registerEndpoint(makeSpec())
    doc.generateOpenApi('T', '1')
    const log = doc.getAuditLog()
    expect(log.some(e => e.action === 'registerEndpoint')).toBe(true)
    expect(log.some(e => e.action === 'generateOpenApi')).toBe(true)
  })
})
