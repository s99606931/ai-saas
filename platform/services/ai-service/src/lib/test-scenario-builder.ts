// SVC-AI-ADV-R41: CSAP/OWASP 테스트 시나리오 빌더
// Design Ref: §모듈, §인터페이스
// Plan SC: FR-R41.2

export interface TestCaseSpec {
  name: string
  description: string
  category: 'unit' | 'integration' | 'security' | 'compliance'
  input: unknown
  expected: unknown
  tags: string[]
}

export type CSAPControl = 'D-06' | 'D-08' | 'D-09' | 'D-12'

/**
 * CSAP/OWASP 테스트 시나리오 템플릿 공급자.
 * 코드 분석 없이도 규제 기반 공통 테스트 케이스를 생성한다.
 */
export class TestScenarioBuilder {
  /**
   * CSAP 특정 통제 항목에 대한 테스트 스펙 목록을 반환한다.
   */
  forCSAP(control: CSAPControl): TestCaseSpec[] {
    switch (control) {
      case 'D-06':
        return this.d06AuditCases()
      case 'D-08':
        return this.d08AccessCases()
      case 'D-09':
        return this.d09CryptoCases()
      case 'D-12':
        return this.d12SecureDevCases()
      default:
        return []
    }
  }

  /**
   * OWASP Top 10 항목에 대한 테스트 스펙 목록을 반환한다 (1~10).
   */
  forOWASP(top: number): TestCaseSpec[] {
    if (top < 1 || top > 10) return []
    const map: Record<number, TestCaseSpec[]> = {
      1: this.owaspBrokenAccess(),
      2: this.owaspCryptoFail(),
      3: this.owaspInjection(),
      4: this.owaspInsecureDesign(),
      5: this.owaspMisconfig(),
      6: this.owaspVulnComponents(),
      7: this.owaspIdentAuthFail(),
      8: this.owaspDataIntegrity(),
      9: this.owaspLoggingFail(),
      10: this.owaspSSRF(),
    }
    return map[top] ?? []
  }

  private d06AuditCases(): TestCaseSpec[] {
    return [
      {
        name: 'audit-log-on-sensitive-action',
        description: 'CSAP D-06: 민감 작업 시 감사 로그 자동 기록',
        category: 'compliance',
        input: { action: 'USER_DELETE', actorId: 'admin1', target: 'user99' },
        expected: { auditWritten: true, fields: ['actor', 'action', 'target', 'timestamp'] },
        tags: ['csap', 'd-06', 'audit'],
      },
      {
        name: 'audit-log-append-only',
        description: 'CSAP D-06: 감사 로그 수정/삭제 불가',
        category: 'compliance',
        input: { mode: 'modify' },
        expected: { error: 'append-only violation' },
        tags: ['csap', 'd-06', 'immutable'],
      },
    ]
  }

  private d08AccessCases(): TestCaseSpec[] {
    return [
      {
        name: 'rbac-forbid-unauthorized',
        description: 'CSAP D-08: 권한 없는 사용자 접근 시 403',
        category: 'security',
        input: { role: 'viewer', endpoint: '/api/admin/users' },
        expected: { status: 403 },
        tags: ['csap', 'd-08', 'rbac'],
      },
      {
        name: 'jwt-expiry-15min',
        description: 'CSAP D-08: 접근 토큰 15분 만료',
        category: 'security',
        input: { tokenAge: 16 * 60 * 1000 },
        expected: { valid: false, reason: 'expired' },
        tags: ['csap', 'd-08', 'session'],
      },
    ]
  }

  private d09CryptoCases(): TestCaseSpec[] {
    return [
      {
        name: 'aes-256-required',
        description: 'CSAP D-09: 민감 데이터 AES-256 암호화',
        category: 'security',
        input: { algorithm: 'AES-128' },
        expected: { accepted: false },
        tags: ['csap', 'd-09', 'crypto'],
      },
      {
        name: 'tls-1-3-required',
        description: 'CSAP D-09: 전송 TLS 1.3 이상',
        category: 'security',
        input: { tlsVersion: '1.1' },
        expected: { accepted: false },
        tags: ['csap', 'd-09', 'tls'],
      },
    ]
  }

  private d12SecureDevCases(): TestCaseSpec[] {
    return [
      {
        name: 'sql-injection-blocked',
        description: 'CSAP D-12: SQL 주입 차단',
        category: 'security',
        input: { email: "admin' OR '1'='1" },
        expected: { sanitized: true, allowed: false },
        tags: ['csap', 'd-12', 'sqli'],
      },
      {
        name: 'xss-sanitized',
        description: 'CSAP D-12: XSS 새니타이제이션',
        category: 'security',
        input: { comment: '<script>alert(1)</script>' },
        expected: { sanitized: '' },
        tags: ['csap', 'd-12', 'xss'],
      },
    ]
  }

  private owaspBrokenAccess(): TestCaseSpec[] {
    return [{ name: 'owasp-1-broken-access', description: 'A01 Broken Access Control', category: 'security', input: {}, expected: {}, tags: ['owasp', 'a01'] }]
  }
  private owaspCryptoFail(): TestCaseSpec[] {
    return [{ name: 'owasp-2-crypto-fail', description: 'A02 Cryptographic Failures', category: 'security', input: {}, expected: {}, tags: ['owasp', 'a02'] }]
  }
  private owaspInjection(): TestCaseSpec[] {
    return [{ name: 'owasp-3-injection', description: 'A03 Injection', category: 'security', input: {}, expected: {}, tags: ['owasp', 'a03'] }]
  }
  private owaspInsecureDesign(): TestCaseSpec[] {
    return [{ name: 'owasp-4-insecure-design', description: 'A04 Insecure Design', category: 'security', input: {}, expected: {}, tags: ['owasp', 'a04'] }]
  }
  private owaspMisconfig(): TestCaseSpec[] {
    return [{ name: 'owasp-5-misconfig', description: 'A05 Security Misconfiguration', category: 'security', input: {}, expected: {}, tags: ['owasp', 'a05'] }]
  }
  private owaspVulnComponents(): TestCaseSpec[] {
    return [{ name: 'owasp-6-vuln-components', description: 'A06 Vulnerable Components', category: 'security', input: {}, expected: {}, tags: ['owasp', 'a06'] }]
  }
  private owaspIdentAuthFail(): TestCaseSpec[] {
    return [{ name: 'owasp-7-ident-auth-fail', description: 'A07 Identification/Auth Failures', category: 'security', input: {}, expected: {}, tags: ['owasp', 'a07'] }]
  }
  private owaspDataIntegrity(): TestCaseSpec[] {
    return [{ name: 'owasp-8-data-integrity', description: 'A08 Software/Data Integrity Failures', category: 'security', input: {}, expected: {}, tags: ['owasp', 'a08'] }]
  }
  private owaspLoggingFail(): TestCaseSpec[] {
    return [{ name: 'owasp-9-logging-fail', description: 'A09 Logging/Monitoring Failures', category: 'security', input: {}, expected: {}, tags: ['owasp', 'a09'] }]
  }
  private owaspSSRF(): TestCaseSpec[] {
    return [{ name: 'owasp-10-ssrf', description: 'A10 SSRF', category: 'security', input: {}, expected: {}, tags: ['owasp', 'a10'] }]
  }
}

export function createTestScenarioBuilder(): TestScenarioBuilder {
  return new TestScenarioBuilder()
}
