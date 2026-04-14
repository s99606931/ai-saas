// Design Ref: §R484 — AI기반 코드 보안 정책 강화 v2
// Plan SC: SVC-AI-ADV-R484-SC01

export type ViolationSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type PolicyCategory = 'SECRETS' | 'INJECTION' | 'CRYPTO' | 'AUTH' | 'LOGGING' | 'INPUT_VALIDATION'

export interface CodeSnippet {
  snippetId: string
  filePath: string
  language: 'typescript' | 'javascript' | 'python' | 'java'
  content: string   // 분석할 코드 내용
}

export interface PolicyViolation {
  violationId: string
  snippetId: string
  category: PolicyCategory
  severity: ViolationSeverity
  line?: number
  detail: string
  remediation: string
}

export interface SecurityPolicyReport {
  snippetId: string
  filePath: string
  violations: PolicyViolation[]
  overallRisk: ViolationSeverity
  passed: boolean   // CRITICAL/HIGH 위반 없음
  score: number     // 0..100
}

interface AuditEntry {
  timestamp: string
  action: string
  snippetId: string
  detail: Record<string, unknown>
}

// 보안 정책 규칙 패턴
const POLICY_RULES: Array<{
  pattern: RegExp
  category: PolicyCategory
  severity: ViolationSeverity
  detail: string
  remediation: string
}> = [
  {
    pattern: /(?:password|secret|api_key|apikey|token)\s*=\s*['"][^'"]{4,}['"]/i,
    category: 'SECRETS',
    severity: 'CRITICAL',
    detail: '하드코딩된 시크릿 탐지 — 환경 변수 또는 시크릿 관리 시스템 사용 필수',
    remediation: 'process.env.SECRET_KEY 또는 Vault/SSM 시크릿 참조로 교체',
  },
  {
    pattern: /eval\s*\(/,
    category: 'INJECTION',
    severity: 'CRITICAL',
    detail: 'eval() 사용 — 코드 인젝션 위험',
    remediation: 'eval() 제거 후 안전한 JSON.parse() 또는 직접 로직으로 대체',
  },
  {
    pattern: /md5\s*\(|new\s+MD5|createHash\s*\(\s*['"]md5['"]/i,
    category: 'CRYPTO',
    severity: 'HIGH',
    detail: 'MD5 해시 사용 — 취약한 알고리즘',
    remediation: 'SHA-256 이상 알고리즘으로 교체 (crypto.createHash("sha256"))',
  },
  {
    pattern: /console\.log\s*\(.*(?:password|secret|token|key)/i,
    category: 'LOGGING',
    severity: 'HIGH',
    detail: '민감 정보 로그 출력 위험',
    remediation: '민감 필드를 마스킹 처리 후 로그 출력',
  },
  {
    pattern: /new\s+Function\s*\(/,
    category: 'INJECTION',
    severity: 'HIGH',
    detail: 'new Function() 동적 코드 실행 위험',
    remediation: '정적 함수 정의로 대체',
  },
  {
    pattern: /http:\/\/(?!localhost)/,
    category: 'CRYPTO',
    severity: 'MEDIUM',
    detail: 'HTTP 평문 통신 — TLS 미적용',
    remediation: 'HTTPS(TLS 1.3+)로 변경',
  },
]

export class CodeSecurityPolicyEnforcerV2 {
  private snippets = new Map<string, CodeSnippet>()
  private auditLog: AuditEntry[] = []

  registerSnippet(snippet: CodeSnippet): void {
    this.snippets.set(snippet.snippetId, snippet)
    this.appendAudit('snippet.register', snippet.snippetId, { filePath: snippet.filePath, language: snippet.language })
  }

  enforce(snippetId: string): SecurityPolicyReport {
    const snippet = this.snippets.get(snippetId)
    if (!snippet) throw new Error(`Unknown snippet: ${snippetId}`)

    this.appendAudit('policy.enforce', snippetId, { filePath: snippet.filePath })

    const violations: PolicyViolation[] = []
    const lines = snippet.content.split('\n')

    for (const rule of POLICY_RULES) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? ''
        if (rule.pattern.test(line)) {
          violations.push({
            violationId: `VIO-${snippetId}-${rule.category}-${i + 1}`,
            snippetId,
            category: rule.category,
            severity: rule.severity,
            line: i + 1,
            detail: rule.detail,
            remediation: rule.remediation,
          })
        }
      }
    }

    const severityOrder: ViolationSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
    const overallRisk: ViolationSeverity = violations.length === 0
      ? 'INFO'
      : severityOrder.find((s) => violations.some((v) => v.severity === s)) ?? 'INFO'

    const criticalHighCount = violations.filter((v) => v.severity === 'CRITICAL' || v.severity === 'HIGH').length
    const score = Math.max(0, 100 - criticalHighCount * 20 - violations.filter((v) => v.severity === 'MEDIUM').length * 5)
    const passed = criticalHighCount === 0

    this.appendAudit('policy.result', snippetId, { violationCount: violations.length, overallRisk, passed, score })

    return { snippetId, filePath: snippet.filePath, violations, overallRisk, passed, score }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, snippetId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, snippetId, detail })
  }
}
