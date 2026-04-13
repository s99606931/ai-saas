// Design Ref: §R301 — AI기반 보안 테스트 자동 생성
// Plan SC: SC-R301

export interface ApiEndpoint {
  endpointId: string
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  authRequired: boolean
  inputFields: { name: string; type: string; sensitive: boolean }[]
}

export interface SecurityTestCase {
  testId: string
  testType: 'SQL_INJECTION' | 'XSS' | 'AUTH_BYPASS' | 'IDOR' | 'SENSITIVE_EXPOSURE'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
  testPayload: string
  expectedBehavior: string
}

export interface GeneratedTestSuite {
  endpointId: string
  path: string
  testCases: SecurityTestCase[]
  coverageTypes: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

let testCounter = 1

function nextTestId(): string {
  return `SEC-TEST-${String(testCounter++).padStart(4, '0')}`
}

export class SecurityTestGeneratorAi {
  private endpoints = new Map<string, ApiEndpoint>()
  private auditLog: AuditEntry[] = []

  registerEndpoint(endpoint: ApiEndpoint): void {
    this.endpoints.set(endpoint.endpointId, endpoint)
    this.auditLog.push({ action: 'endpoint.register', timestamp: new Date().toISOString(), detail: endpoint.endpointId })
  }

  generate(endpointId: string): GeneratedTestSuite {
    const endpoint = this.endpoints.get(endpointId)
    if (!endpoint) throw new Error(`Endpoint not found: ${endpointId}`)

    const testCases: SecurityTestCase[] = []
    const coverageTypes = new Set<string>()

    // SQL Injection 테스트 — 입력 필드 대상
    for (const field of endpoint.inputFields) {
      if (field.type === 'string') {
        testCases.push({
          testId: nextTestId(),
          testType: 'SQL_INJECTION',
          severity: 'CRITICAL',
          description: `${field.name} 필드 SQL 주입 취약점 검사`,
          testPayload: `'; DROP TABLE users; --`,
          expectedBehavior: '400 또는 422 반환, DB 오류 메시지 미노출',
        })
        coverageTypes.add('SQL_INJECTION')

        testCases.push({
          testId: nextTestId(),
          testType: 'XSS',
          severity: 'HIGH',
          description: `${field.name} 필드 XSS 취약점 검사`,
          testPayload: `<script>alert('xss')</script>`,
          expectedBehavior: '입력값 새니타이즈 후 저장, 스크립트 실행 불가',
        })
        coverageTypes.add('XSS')
      }
    }

    // 인증 우회 테스트
    if (endpoint.authRequired) {
      testCases.push({
        testId: nextTestId(),
        testType: 'AUTH_BYPASS',
        severity: 'CRITICAL',
        description: '인증 토큰 없이 엔드포인트 접근 시도',
        testPayload: 'Authorization: (empty)',
        expectedBehavior: '401 Unauthorized 반환',
      })
      coverageTypes.add('AUTH_BYPASS')
    }

    // IDOR 테스트
    if (endpoint.method === 'GET' || endpoint.method === 'PUT' || endpoint.method === 'DELETE') {
      testCases.push({
        testId: nextTestId(),
        testType: 'IDOR',
        severity: 'HIGH',
        description: '타 사용자 리소스 직접 접근 시도 (IDOR)',
        testPayload: `${endpoint.path}/OTHER_USER_ID`,
        expectedBehavior: '403 Forbidden 반환',
      })
      coverageTypes.add('IDOR')
    }

    // 민감 정보 노출 테스트
    const hasSensitiveField = endpoint.inputFields.some((f) => f.sensitive)
    if (hasSensitiveField) {
      testCases.push({
        testId: nextTestId(),
        testType: 'SENSITIVE_EXPOSURE',
        severity: 'HIGH',
        description: '에러 응답에서 민감 정보 노출 여부 검사',
        testPayload: '잘못된 입력으로 에러 유발',
        expectedBehavior: '에러 응답에 PII/내부 경로/스택트레이스 미포함',
      })
      coverageTypes.add('SENSITIVE_EXPOSURE')
    }

    this.auditLog.push({ action: 'test.generate', timestamp: new Date().toISOString(), detail: `${endpointId}: ${testCases.length}개` })
    return { endpointId, path: endpoint.path, testCases, coverageTypes: Array.from(coverageTypes) }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
