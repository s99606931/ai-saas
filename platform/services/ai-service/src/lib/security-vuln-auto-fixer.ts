// Design Ref: §R197 — AI기반 보안 취약점 자동 수정
// Plan SC: SVC-AI-ADV-R197-SC01

export type VulnSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type VulnCategory = 'SQL_INJECTION' | 'XSS' | 'HARDCODED_SECRET' | 'INSECURE_DESERIALIZATION' | 'PATH_TRAVERSAL' | 'WEAK_CRYPTO'
export type FixStatus = 'FIXED' | 'PARTIAL' | 'MANUAL_REQUIRED' | 'SKIPPED'

export interface Vulnerability {
  vulnId: string
  file: string
  line: number
  category: VulnCategory
  severity: VulnSeverity
  description: string
  codeSnippet: string
}

export interface FixResult {
  vulnId: string
  status: FixStatus
  originalCode: string
  fixedCode: string
  explanation: string
  autoApplied: boolean
}

export interface FixReport {
  totalVulns: number
  fixed: number
  partial: number
  manualRequired: number
  skipped: number
  results: FixResult[]
}

interface AuditEntry {
  timestamp: string
  action: string
  vulnId: string
  detail: Record<string, unknown>
}

const FIX_TEMPLATES: Record<VulnCategory, (snippet: string) => { fixedCode: string; explanation: string; autoApplied: boolean }> = {
  SQL_INJECTION: (s) => ({
    fixedCode: s.replace(/`SELECT.*WHERE.*=.*\${.*}`/g, 'db.execute(query, [param])'),
    explanation: '매개변수화 쿼리로 교체하여 SQL 주입 방지',
    autoApplied: true,
  }),
  XSS: (s) => ({
    fixedCode: s.replace(/innerHTML\s*=/, 'textContent ='),
    explanation: 'innerHTML을 textContent로 교체하여 XSS 방지',
    autoApplied: true,
  }),
  HARDCODED_SECRET: (s) => ({
    fixedCode: s.replace(/(['"])[A-Za-z0-9]{16,}(['"])/, 'process.env.SECRET_KEY'),
    explanation: '하드코딩된 시크릿을 환경 변수로 교체',
    autoApplied: true,
  }),
  WEAK_CRYPTO: (s) => ({
    fixedCode: s.replace(/md5|sha1/gi, 'sha256'),
    explanation: '취약한 해시 알고리즘을 SHA-256으로 교체',
    autoApplied: true,
  }),
  INSECURE_DESERIALIZATION: (_s) => ({
    fixedCode: '// TODO: 안전한 직렬화 라이브러리 사용 필요',
    explanation: '안전한 역직렬화 패턴 수동 검토 필요',
    autoApplied: false,
  }),
  PATH_TRAVERSAL: (_s) => ({
    fixedCode: '// TODO: path.resolve + allowedBasePath 검증 필요',
    explanation: '경로 탐색 취약점 수동 검토 필요',
    autoApplied: false,
  }),
}

export class SecurityVulnAutoFixer {
  private vulns = new Map<string, Vulnerability>()
  private auditLog: AuditEntry[] = []

  registerVuln(vuln: Vulnerability): void {
    this.vulns.set(vuln.vulnId, vuln)
    this.appendAudit('vuln.register', vuln.vulnId, { category: vuln.category, severity: vuln.severity })
  }

  fix(vulnId: string): FixResult {
    const vuln = this.vulns.get(vulnId)
    if (!vuln) throw new Error(`Unknown vulnerability: ${vulnId}`)

    const template = FIX_TEMPLATES[vuln.category]
    const { fixedCode, explanation, autoApplied } = template(vuln.codeSnippet)

    const status: FixStatus = autoApplied ? 'FIXED' : 'MANUAL_REQUIRED'

    this.appendAudit('vuln.fix', vulnId, { status, autoApplied })

    return {
      vulnId,
      status,
      originalCode: vuln.codeSnippet,
      fixedCode,
      explanation,
      autoApplied,
    }
  }

  fixAll(): FixReport {
    const results: FixResult[] = []
    let fixed = 0
    let partial = 0
    let manualRequired = 0
    let skipped = 0

    // CRITICAL/HIGH 먼저 처리
    const sorted = [...this.vulns.values()].sort((a, b) => {
      const weight = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 } as const
      return weight[b.severity] - weight[a.severity]
    })

    for (const vuln of sorted) {
      const result = this.fix(vuln.vulnId)
      results.push(result)
      if (result.status === 'FIXED') fixed++
      else if (result.status === 'PARTIAL') partial++
      else if (result.status === 'MANUAL_REQUIRED') manualRequired++
      else skipped++
    }

    return { totalVulns: this.vulns.size, fixed, partial, manualRequired, skipped, results }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, vulnId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, vulnId, detail })
  }
}
