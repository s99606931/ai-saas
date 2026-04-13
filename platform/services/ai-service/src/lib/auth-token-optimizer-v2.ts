// Design Ref: §핵심 알고리즘 — 토큰 상태 추적, 만료 예정 알림
// Plan SC: SVC-AI-ADV-R411
export type DataGrade = 'O' | 'C' | 'S'
export type TokenStatus = 'active' | 'expired' | 'revoked'

export interface TokenEntry {
  id: string
  userId: string
  tokenType: string
  issuedAt: number
  expiresAt: number
  revoked: boolean
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

let tokenCounter = 0

export class AuthTokenOptimizerV2 {
  private tokens = new Map<string, TokenEntry>()
  private auditLog: AuditEntry[] = []

  issueToken(userId: string, tokenType: string, ttlMs: number): TokenEntry {
    if (!userId || !tokenType) throw new Error('userId와 tokenType은 필수')
    if (ttlMs <= 0) throw new Error('ttlMs는 양수여야 합니다')
    const id = `tok-${++tokenCounter}`
    const issuedAt = Date.now()
    const entry: TokenEntry = { id, userId, tokenType, issuedAt, expiresAt: issuedAt + ttlMs, revoked: false }
    this.tokens.set(id, entry)
    this.auditLog.push({ action: 'token.issue', timestamp: new Date().toISOString(), detail: `${userId}:${tokenType}` })
    return entry
  }

  getTokenStatus(tokenId: string): TokenStatus {
    const token = this.tokens.get(tokenId)
    if (!token) throw new Error(`tokenId 없음: ${tokenId}`)
    if (token.revoked) return 'revoked'
    if (Date.now() >= token.expiresAt) return 'expired'
    return 'active'
  }

  getExpiringTokens(warningMs: number): TokenEntry[] {
    const now = Date.now()
    return [...this.tokens.values()].filter((t) => {
      if (t.revoked || now >= t.expiresAt) return false
      return (t.expiresAt - now) < warningMs
    })
  }

  revokeToken(tokenId: string): void {
    const token = this.tokens.get(tokenId)
    if (!token) throw new Error(`tokenId 없음: ${tokenId}`)
    token.revoked = true
    this.auditLog.push({ action: 'token.revoke', timestamp: new Date().toISOString(), detail: tokenId })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
