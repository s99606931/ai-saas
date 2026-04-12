// Design Ref: §R306 — AI기반 인증 토큰 자동 관리
// Plan SC: SC-R306

import { randomUUID } from 'node:crypto'

export type DataGrade = 'O' | 'C' | 'S'
export type TokenStatus = 'active' | 'expired' | 'revoked'

export interface TokenRecord {
  id: string
  owner: string
  type: string
  issuedAt: number
  expiresAt: number
  status: TokenStatus
}

export interface ValidationResult {
  valid: boolean
  reason?: 'EXPIRED' | 'REVOKED' | 'NOT_FOUND' | 'OK'
  tokenId?: string
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskOwner(owner: string): string {
  if (owner.length <= 2) return '**'
  return owner.substring(0, 2) + '*'.repeat(Math.max(1, owner.length - 2))
}

export class AuthTokenLifecycleManagerAI {
  private tokens = new Map<string, TokenRecord>()
  private blacklist = new Set<string>()
  private auditLog: AuditEntry[] = []

  issueToken(owner: string, type: string, ttlMs: number, grade: DataGrade = 'O'): TokenRecord {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 토큰 발급 금지 (N2SF N-05)`)
    }
    if (!owner || !type) throw new Error('owner와 type은 필수')
    if (ttlMs <= 0) throw new Error('ttlMs는 양수여야 합니다')
    const id = randomUUID()
    const now = Date.now()
    const record: TokenRecord = {
      id,
      owner,
      type,
      issuedAt: now,
      expiresAt: now + ttlMs,
      status: 'active',
    }
    this.tokens.set(id, record)
    this.auditLog.push({
      action: 'token.issue',
      timestamp: new Date().toISOString(),
      detail: `${type}:${maskOwner(owner)}`,
    })
    return { ...record }
  }

  validateToken(tokenId: string): ValidationResult {
    const token = this.tokens.get(tokenId)
    if (!token) {
      this.auditLog.push({ action: 'token.validate', timestamp: new Date().toISOString(), detail: 'NOT_FOUND' })
      return { valid: false, reason: 'NOT_FOUND' }
    }
    if (this.blacklist.has(tokenId)) {
      return { valid: false, reason: 'REVOKED', tokenId }
    }
    if (Date.now() >= token.expiresAt) {
      token.status = 'expired'
      return { valid: false, reason: 'EXPIRED', tokenId }
    }
    return { valid: true, reason: 'OK', tokenId }
  }

  renewToken(tokenId: string, newTtlMs?: number): TokenRecord {
    const token = this.tokens.get(tokenId)
    if (!token) throw new Error(`tokenId 없음: ${tokenId}`)
    if (this.blacklist.has(tokenId)) throw new Error('폐기된 토큰은 갱신 불가')
    const ttl = newTtlMs ?? token.expiresAt - token.issuedAt
    if (ttl <= 0) throw new Error('ttlMs는 양수여야 합니다')
    const now = Date.now()
    token.issuedAt = now
    token.expiresAt = now + ttl
    token.status = 'active'
    this.auditLog.push({ action: 'token.renew', timestamp: new Date().toISOString(), detail: tokenId })
    return { ...token }
  }

  revokeToken(tokenId: string): void {
    const token = this.tokens.get(tokenId)
    if (!token) throw new Error(`tokenId 없음: ${tokenId}`)
    this.blacklist.add(tokenId)
    token.status = 'revoked'
    this.auditLog.push({ action: 'token.revoke', timestamp: new Date().toISOString(), detail: tokenId })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
