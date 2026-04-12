/**
 * Data Policy Enforcer — SVC-AI-ADV-R110 (트랙 B)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R110.design.md
 * Plan SC: FR-R110.1 ~ FR-R110.5
 *
 * 코드/쿼리 정적 스캔 → 데이터 정책 위반 탐지 → 수정 제안 자동 생성.
 * CSAP D-12 시스템 개발 보안 준수. 외부 API 없음.
 */

// Design Ref: §2 — 타입 정의

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type Language = 'typescript' | 'javascript' | 'python' | 'sql'

export interface DataPolicy {
  policyId: string
  name: string
  pattern: string
  severity: Severity
  description: string
  suggestedFix: string
  autoFix?: boolean
}

export interface PolicyViolation {
  policyId: string
  policyName: string
  severity: Severity
  matchedText: string
  lineNumber: number
  columnStart: number
  description: string
}

export interface FixSuggestion {
  violation: PolicyViolation
  suggestion: string
  autoFixable: boolean
}

export interface ScanResult {
  violations: PolicyViolation[]
  fixes: FixSuggestion[]
  scannedAt: string
  totalLines: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  language: Language
  violationCount: number
}

// Design Ref: §3.3 기본 정책 (CSAP D-12)
const DEFAULT_POLICIES: DataPolicy[] = [
  {
    policyId: 'P-001',
    name: '하드코딩 시크릿 금지',
    pattern: String.raw`(?:api[_-]?key|password|secret|token)\s*[=:]\s*['"][^'"]{8,}['"]`,
    severity: 'CRITICAL',
    description: '하드코딩된 시크릿 발견. 환경 변수로 대체하십시오 (CSAP D-12)',
    suggestedFix: '환경 변수 사용: process.env.SECRET_KEY (또는 해당 언어의 환경 변수 접근 방식)',
    autoFix: false,
  },
  {
    policyId: 'P-002',
    name: 'SQL 직접 문자열 결합 금지',
    pattern: String.raw`SELECT\s+.+\$\{`,
    severity: 'HIGH',
    description: 'SQL 문자열에 변수 직접 결합 발견. 매개변수화 쿼리를 사용하십시오 (CSAP D-12)',
    suggestedFix: '매개변수화 쿼리 사용: db.execute("SELECT ... WHERE col = $1", [value])',
    autoFix: false,
  },
  {
    policyId: 'P-003',
    name: '로그에 민감 정보 출력 금지',
    pattern: String.raw`console\.\s*(?:log|error|warn)\s*\([^)]*(?:password|secret|token|key)[^)]*\)`,
    severity: 'MEDIUM',
    description: '로그에 민감 정보 포함 가능. 민감 필드를 제거하십시오 (CSAP D-06)',
    suggestedFix: '민감 필드 제거 후 로깅: console.log({ userId: user.id })',
    autoFix: false,
  },
  {
    policyId: 'P-004',
    name: '평문 비밀번호 저장 금지',
    pattern: String.raw`(?:password|passwd)\s*:\s*(?:req\.|body\.|user\.)?(?:password|passwd)(?!\s*(?:hash|bcrypt|encrypted))`,
    severity: 'CRITICAL',
    description: '평문 비밀번호 저장 가능성. bcrypt 해시 후 저장하십시오 (CSAP D-09)',
    suggestedFix: 'bcrypt.hash(password, 12) 후 저장',
    autoFix: false,
  },
]

export class DataPolicyEnforcer {
  private readonly policies = new Map<string, DataPolicy>()
  private readonly auditLog: AuditEntry[] = []

  constructor() {
    // 기본 CSAP D-12 정책 자동 등록
    for (const policy of DEFAULT_POLICIES) {
      this.policies.set(policy.policyId, policy)
    }
  }

  // Plan SC: FR-R110.1
  registerPolicy(policy: DataPolicy): void {
    if (!policy.policyId || !policy.pattern) {
      throw new Error('policyId와 pattern은 필수입니다')
    }
    // 유효한 정규식인지 검증
    try {
      new RegExp(policy.pattern, 'gi')
    } catch {
      throw new Error(`유효하지 않은 정규식: ${policy.pattern}`)
    }
    this.policies.set(policy.policyId, { ...policy })
  }

  // Plan SC: FR-R110.2 — Design Ref: §3.1 스캔
  scanCode(code: string, language: Language): PolicyViolation[] {
    const lines = code.split('\n')
    const violations: PolicyViolation[] = []

    for (const policy of this.policies.values()) {
      const regex = new RegExp(policy.pattern, 'gi')
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx]!
        let match: RegExpExecArray | null
        regex.lastIndex = 0
        while ((match = regex.exec(line)) !== null) {
          violations.push({
            policyId: policy.policyId,
            policyName: policy.name,
            severity: policy.severity,
            matchedText: match[0],
            lineNumber: lineIdx + 1,
            columnStart: match.index,
            description: policy.description,
          })
        }
      }
    }

    this.appendAudit('code.scan', language, violations.length)
    return violations
  }

  // Plan SC: FR-R110.3 — Design Ref: §3.2 수정 제안
  suggestFix(violation: PolicyViolation): FixSuggestion {
    const policy = this.policies.get(violation.policyId)
    const suggestion = policy
      ? policy.suggestedFix.replace('{matched}', violation.matchedText)
      : `${violation.policyId} 정책 위반: 수동 검토 필요`
    return {
      violation,
      suggestion,
      autoFixable: policy?.autoFix ?? false,
    }
  }

  // Plan SC: FR-R110.4
  scanAndFix(code: string, language: Language): ScanResult {
    const violations = this.scanCode(code, language)
    const fixes = violations.map((v) => this.suggestFix(v))
    return {
      violations,
      fixes,
      scannedAt: new Date().toISOString(),
      totalLines: code.split('\n').length,
    }
  }

  // Plan SC: FR-R110.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  getPolicies(): DataPolicy[] {
    return [...this.policies.values()]
  }

  private appendAudit(action: string, language: Language, violationCount: number): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      language,
      violationCount,
    })
  }
}
