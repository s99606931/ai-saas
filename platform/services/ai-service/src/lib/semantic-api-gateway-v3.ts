/**
 * Semantic API Gateway V3 — SVC-AI-ADV-R663 (트랙 A 24차)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R663.design.md
 * Plan SC: FR-R663.1 ~ FR-R663.6
 *
 * 자연어 요청 → API 시맨틱 라우팅 (top-k).
 * N2SF N-05: C/S 등급 차단. PII 패턴 마스킹.
 */

import { createHash } from 'crypto'

export type DataGrade = 'C' | 'S' | 'O'

export interface APIDef {
  apiId: string
  description: string
  keywords: string[]
}

export interface RouteCandidate {
  apiId: string
  description: string
  score: number
}

export interface RouteResponse {
  utteranceMasked: string
  candidates: RouteCandidate[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  apiId: string
  detail: Record<string, unknown>
}

const PII_PATTERNS: RegExp[] = [
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
  /\b01[016789]-?\d{3,4}-?\d{4}\b/g,
  /\b\d{6}-?\d{7}\b/g,
]

export class SemanticAPIGatewayV3 {
  private readonly apis = new Map<string, APIDef>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R663.1
  registerAPI(api: APIDef): APIDef {
    if (this.apis.has(api.apiId)) {
      throw new Error(`API already exists: ${api.apiId}`)
    }
    if (api.keywords.length === 0) {
      throw new Error('API must have at least one keyword')
    }
    const stored: APIDef = {
      apiId: api.apiId,
      description: api.description,
      keywords: api.keywords.map((k) => k.toLowerCase()),
    }
    this.apis.set(api.apiId, stored)
    this.appendAudit('api.register', api.apiId, { keywordCount: api.keywords.length })
    return { ...stored, keywords: [...stored.keywords] }
  }

  // Plan SC: FR-R663.2 + FR-R663.3 + FR-R663.4 + FR-R663.5
  route(utterance: string, topK = 3, dataGrade: DataGrade = 'O'): RouteResponse {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (topK < 1) throw new Error('topK must be >= 1')

    const masked = this.maskUtterance(utterance)
    const tokens = utterance
      .toLowerCase()
      .split(/[\s,.:;!?()[\]{}"'""''·\-/\\]+/)
      .filter((t) => t.length > 0)

    const scored: RouteCandidate[] = []
    for (const api of this.apis.values()) {
      const matches = api.keywords.filter((k) => tokens.includes(k)).length
      if (matches === 0) continue
      const score = matches / Math.sqrt(api.keywords.length * Math.max(1, tokens.length))
      scored.push({ apiId: api.apiId, description: api.description, score })
    }
    scored.sort((a, b) => b.score - a.score)
    const candidates = scored.slice(0, topK)
    this.appendAudit('route', candidates[0]?.apiId ?? '-', { matched: candidates.length })
    return { utteranceMasked: masked, candidates }
  }

  // Plan SC: FR-R663.6 — CSAP D-06
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

  private appendAudit(action: string, apiId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, apiId, detail })
  }
}
