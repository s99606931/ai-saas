/**
 * Contract Automation AI — SVC-AI-ADV-R135 (트랙 B 2차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R130-R137-trackB/SVC-AI-ADV-R135.design.md
 * Plan SC: FR-R135.1 ~ FR-R135.5
 *
 * 표준 계약 조항 자동 생성 + 리스크 조항 탐지.
 * 템플릿 + 패턴 기반 — 외부 API 없음.
 */

// Design Ref: §2 — 타입 정의

export interface ClauseTemplate {
  templateId: string
  type: string
  title: string
  body: string
  order?: number
}

export interface ContractDraft {
  contractId: string
  type: string
  clauses: string[]
  generatedAt: string
}

export interface RiskPattern {
  patternId: string
  pattern: string
  description: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface RiskDetection {
  patternId: string
  matchedText: string
  description: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  lineNumber: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

// 기본 리스크 패턴
const DEFAULT_RISK_PATTERNS: RiskPattern[] = [
  {
    patternId: 'RP-001',
    pattern: String.raw`일방적\s*(?:해지|계약해제|변경)`,
    description: '일방적 계약 해지/변경 조항 — 을에게 불리한 불공정 조항 가능성',
    severity: 'HIGH',
  },
  {
    patternId: 'RP-002',
    pattern: String.raw`(?:손해배상|배상책임)\s*(?:없음|면제|제외)`,
    description: '손해배상 책임 면제 조항 — 피해 시 구제 불가 위험',
    severity: 'HIGH',
  },
  {
    patternId: 'RP-003',
    pattern: String.raw`자동\s*(?:연장|갱신|계약)`,
    description: '자동 연장 조항 — 의도치 않은 계약 지속 위험',
    severity: 'MEDIUM',
  },
  {
    patternId: 'RP-004',
    pattern: String.raw`(?:위약금|페널티)\s*\d+\s*%?(?:\s*이상|\s*초과)`,
    description: '과도한 위약금 조항 — 법정 한도 초과 여부 검토 필요',
    severity: 'MEDIUM',
  },
]

let contractCounter = 0

export class ContractAutomationAi {
  private readonly templates = new Map<string, ClauseTemplate[]>()
  private readonly riskPatterns = new Map<string, RiskPattern>()
  private readonly auditLog: AuditEntry[] = []

  constructor() {
    for (const p of DEFAULT_RISK_PATTERNS) {
      this.riskPatterns.set(p.patternId, p)
    }
  }

  // Plan SC: FR-R135.1
  registerClauseTemplate(template: ClauseTemplate): void {
    const list = this.templates.get(template.type) ?? []
    list.push({ ...template })
    list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    this.templates.set(template.type, list)
  }

  // Plan SC: FR-R135.2 — Design Ref: §3.1 변수 치환, §3.2 조항 조립
  generateContract(type: string, variables: Record<string, string> = {}): ContractDraft {
    const clauseTemplates = this.templates.get(type) ?? []
    const clauses = clauseTemplates.map((t) => {
      let body = t.body
      for (const [key, value] of Object.entries(variables)) {
        body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      }
      return `## ${t.title}\n\n${body}`
    })

    const contractId = `contract-${++contractCounter}-${Date.now()}`
    this.appendAudit('contract.generate', { contractId, type, clauses: clauses.length })

    return {
      contractId,
      type,
      clauses,
      generatedAt: new Date().toISOString(),
    }
  }

  // Plan SC: FR-R135.3 — Design Ref: §3.3 리스크 탐지
  detectRiskClauses(contractText: string): RiskDetection[] {
    const lines = contractText.split('\n')
    const detections: RiskDetection[] = []

    for (const pattern of this.riskPatterns.values()) {
      const regex = new RegExp(pattern.pattern, 'gi')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        regex.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = regex.exec(line)) !== null) {
          detections.push({
            patternId: pattern.patternId,
            matchedText: match[0],
            description: pattern.description,
            severity: pattern.severity,
            lineNumber: i + 1,
          })
        }
      }
    }

    this.appendAudit('risk.detect', { detectionCount: detections.length })
    return detections
  }

  // Plan SC: FR-R135.4
  addRiskPattern(pattern: RiskPattern): void {
    try {
      new RegExp(pattern.pattern, 'gi')
    } catch {
      throw new Error(`유효하지 않은 정규식: ${pattern.pattern}`)
    }
    this.riskPatterns.set(pattern.patternId, { ...pattern })
  }

  // Plan SC: FR-R135.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
