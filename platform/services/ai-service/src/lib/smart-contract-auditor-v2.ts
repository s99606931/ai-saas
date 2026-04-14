// Design Ref: §설계 결정 — 정규식 기반 Solidity 취약점 탐지
// Plan SC: SVC-AI-ADV-R617
export type DataGrade = 'O' | 'C' | 'S'

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface Finding {
  rule: string
  severity: Severity
  description: string
  line?: number
}

export interface AuditResult {
  contractId: string
  findings: Finding[]
  overallSeverity: Severity
}

export interface AuditEntry {
  timestamp: string
  action: string
  details?: Record<string, unknown>
}

interface Rule {
  name: string
  pattern: RegExp
  severity: Severity
  description: string
}

const RULES: Rule[] = [
  {
    name: 'outdated-pragma',
    pattern: /pragma\s+solidity\s+\^?0\.4/,
    severity: 'CRITICAL',
    description: '오래된 Solidity 0.4.x 사용 — 취약점 다수',
  },
  {
    name: 'tx-origin',
    pattern: /\btx\.origin\b/,
    severity: 'HIGH',
    description: 'tx.origin 기반 인증은 피싱에 취약',
  },
  {
    name: 'unchecked-send',
    pattern: /\.send\(/,
    severity: 'HIGH',
    description: '.send() 반환값 미확인 가능성',
  },
  {
    name: 'low-level-call',
    pattern: /\.call\{value:/,
    severity: 'HIGH',
    description: 'Low-level call.value 사용 — reentrancy 위험',
  },
  {
    name: 'block-timestamp',
    pattern: /block\.timestamp/,
    severity: 'MEDIUM',
    description: 'block.timestamp 의존 — 마이너 조작 가능',
  },
  {
    name: 'selfdestruct',
    pattern: /selfdestruct\s*\(/,
    severity: 'MEDIUM',
    description: 'selfdestruct 호출 — 접근 통제 재확인 필요',
  },
]

const SEVERITY_ORDER: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export class SmartContractAuditorV2 {
  private contracts = new Map<string, string>()
  private auditLog: AuditEntry[] = []

  registerContract(id: string, source: string, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!id || !source) throw new Error('id와 source는 필수')
    this.contracts.set(id, source)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'contract.register',
      details: { id, length: source.length },
    })
  }

  audit(id: string): AuditResult {
    const source = this.contracts.get(id)
    if (!source) throw new Error(`계약 없음: ${id}`)
    const findings: Finding[] = []
    const lines = source.split('\n')
    for (const rule of RULES) {
      for (let i = 0; i < lines.length; i++) {
        if (rule.pattern.test(lines[i]!)) {
          findings.push({
            rule: rule.name,
            severity: rule.severity,
            description: rule.description,
            line: i + 1,
          })
        }
      }
    }
    const overallSeverity = this.computeOverall(findings)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'contract.audit',
      details: { id, findings: findings.length, overallSeverity },
    })
    return { contractId: id, findings, overallSeverity }
  }

  private computeOverall(findings: Finding[]): Severity {
    if (findings.length === 0) return 'LOW'
    let maxIdx = 0
    for (const f of findings) {
      const idx = SEVERITY_ORDER.indexOf(f.severity)
      if (idx > maxIdx) maxIdx = idx
    }
    return SEVERITY_ORDER[maxIdx]!
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
