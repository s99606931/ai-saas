// Design Ref: §만료 판단 — ServiceTokenSecurityManagerV2
// Plan SC: SVC-AI-ADV-R508

import { createHash } from 'crypto'

interface ServiceToken {
  tokenId: string
  serviceId: string
  tokenType: string
  expiresAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  tokenId: string
  maskedClientId?: string
  details?: Record<string, unknown>
}

export class ServiceTokenSecurityManagerV2 {
  private tokens = new Map<string, ServiceToken>()
  private auditLog: AuditEntry[] = []

  registerToken(
    tokenId: string,
    serviceId: string,
    tokenType: string,
    expiresAt: string
  ): ServiceToken {
    const token: ServiceToken = { tokenId, serviceId, tokenType, expiresAt }
    this.tokens.set(tokenId, token)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_TOKEN',
      tokenId,
      details: { serviceId, tokenType, expiresAt },
    })
    return token
  }

  recordUsage(tokenId: string, clientId: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.tokens.has(tokenId)) throw new Error(`토큰을 찾을 수 없습니다: ${tokenId}`)
    const maskedClientId = createHash('sha256').update(clientId).digest('hex').substring(0, 16)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_USAGE',
      tokenId,
      maskedClientId,
      details: { used: true },
    })
  }

  isExpired(tokenId: string): boolean {
    const token = this.tokens.get(tokenId)
    if (!token) throw new Error(`토큰을 찾을 수 없습니다: ${tokenId}`)
    return new Date(token.expiresAt) < new Date()
  }

  getExpiredTokens(): ServiceToken[] {
    return Array.from(this.tokens.values()).filter((t) => new Date(t.expiresAt) < new Date())
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
