/**
 * Public Service Chatbot Enhancer V3 — SVC-AI-ADV-R656 (트랙 A 24차)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R656.design.md
 * Plan SC: FR-R656.1 ~ FR-R656.6
 *
 * 멀티 도메인 라우팅 + 페르소나 + 폴백.
 * N2SF N-05: C/S 등급 차단. PII 패턴 마스킹.
 */

import { createHash } from 'crypto'

export type DataGrade = 'C' | 'S' | 'O'

export interface DomainConfig {
  domainId: string
  keywords: string[]
  persona: string
}

export interface RouteResult {
  utteranceMasked: string
  domainId: string
  persona: string
  confidence: number
  fallback: boolean
}

export interface AuditEntry {
  timestamp: string
  action: string
  domainId: string
  detail: Record<string, unknown>
}

const FALLBACK_DOMAIN: DomainConfig = {
  domainId: 'general',
  keywords: [],
  persona: '공공서비스 안내',
}
const CONFIDENCE_THRESHOLD = 0.3

const PII_PATTERNS: RegExp[] = [
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, // email
  /\b01[016789]-?\d{3,4}-?\d{4}\b/g, // phone
  /\b\d{6}-?\d{7}\b/g, // RRN
]

export class PublicServiceChatbotEnhancerV3 {
  private readonly domains = new Map<string, DomainConfig>()
  private readonly auditLog: AuditEntry[] = []

  constructor() {
    this.domains.set(FALLBACK_DOMAIN.domainId, FALLBACK_DOMAIN)
  }

  // Plan SC: FR-R656.1
  registerDomain(config: DomainConfig): DomainConfig {
    if (config.domainId === FALLBACK_DOMAIN.domainId) {
      throw new Error(`Reserved domainId: ${config.domainId}`)
    }
    this.domains.set(config.domainId, { ...config, keywords: [...config.keywords] })
    this.appendAudit('domain.register', config.domainId, { keywordCount: config.keywords.length })
    return { ...config, keywords: [...config.keywords] }
  }

  // Plan SC: FR-R656.2 + FR-R656.3 + FR-R656.4 + FR-R656.5
  route(utterance: string, dataGrade: DataGrade = 'O'): RouteResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const masked = this.maskUtterance(utterance)
    const tokens = utterance
      .toLowerCase()
      .split(/[\s,.:;!?()[\]{}"'""''·\-/\\]+/)
      .filter((t) => t.length > 0)

    let bestDomain: DomainConfig = FALLBACK_DOMAIN
    let bestScore = 0
    for (const domain of this.domains.values()) {
      if (domain.domainId === FALLBACK_DOMAIN.domainId) continue
      const matches = domain.keywords.filter((k) => tokens.includes(k.toLowerCase())).length
      const score = matches / Math.max(1, tokens.length)
      if (score > bestScore) {
        bestScore = score
        bestDomain = domain
      }
    }

    const fallback = bestScore < CONFIDENCE_THRESHOLD
    const finalDomain = fallback ? FALLBACK_DOMAIN : bestDomain
    this.appendAudit('route', finalDomain.domainId, { confidence: bestScore, fallback })
    return {
      utteranceMasked: masked,
      domainId: finalDomain.domainId,
      persona: finalDomain.persona,
      confidence: bestScore,
      fallback,
    }
  }

  // Plan SC: FR-R656.6 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private maskUtterance(text: string): string {
    let result = text
    for (const pattern of PII_PATTERNS) {
      result = result.replace(pattern, (m) =>
        createHash('sha256').update(m).digest('hex').substring(0, 16),
      )
    }
    return result
  }

  private appendAudit(action: string, domainId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, domainId, detail })
  }
}
