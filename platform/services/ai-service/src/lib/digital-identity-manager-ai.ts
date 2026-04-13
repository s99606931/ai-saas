// Design Ref: §R335 — AI기반 공공기관 디지털 아이덴티티
// Plan SC: SC-R335

export interface DigitalIdentity {
  identityId: string
  userId: string
  orgId: string
  identityType: 'CITIZEN' | 'OFFICIAL' | 'SYSTEM'
  verificationLevel: 'UNVERIFIED' | 'BASIC' | 'STRONG' | 'BIOMETRIC'
  attributes: { key: string; value: string; sensitive: boolean }[]
  issuedAt: string
  expiresAt: string
}

export interface IdentityVerificationRequest {
  identityId: string
  requestedAttributes: string[]
  requestorOrgId: string
  purpose: string
}

export interface VerificationResult {
  identityId: string
  isValid: boolean
  verificationLevel: DigitalIdentity['verificationLevel']
  disclosedAttributes: { key: string; value: string }[]
  maskedAttributes: { key: string; maskedValue: string }[]
  expiryStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED'
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskValue(value: string): string {
  if (value.length <= 2) return '*'.repeat(value.length)
  return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1]
}

export class DigitalIdentityManagerAi {
  private identities = new Map<string, DigitalIdentity>()
  private auditLog: AuditEntry[] = []

  registerIdentity(identity: DigitalIdentity): void {
    this.identities.set(identity.identityId, identity)
    // PII 마스킹 — 감사 로그에 userId 원본 미기록
    const maskedUserId = maskValue(identity.userId)
    this.auditLog.push({ action: 'identity.register', timestamp: new Date().toISOString(), detail: `${identity.identityId}(${maskedUserId})` })
  }

  verify(request: IdentityVerificationRequest): VerificationResult {
    const identity = this.identities.get(request.identityId)
    if (!identity) throw new Error(`Identity not found: ${request.identityId}`)

    const now = new Date()
    const expiresAt = new Date(identity.expiresAt)
    const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    let expiryStatus: VerificationResult['expiryStatus']
    if (daysUntilExpiry < 0) {
      expiryStatus = 'EXPIRED'
    } else if (daysUntilExpiry <= 30) {
      expiryStatus = 'EXPIRING_SOON'
    } else {
      expiryStatus = 'VALID'
    }

    const isValid = expiryStatus !== 'EXPIRED'
    const disclosedAttributes: { key: string; value: string }[] = []
    const maskedAttributes: { key: string; maskedValue: string }[] = []

    for (const attr of identity.attributes) {
      if (!request.requestedAttributes.includes(attr.key)) continue
      if (attr.sensitive) {
        maskedAttributes.push({ key: attr.key, maskedValue: maskValue(attr.value) })
      } else {
        disclosedAttributes.push({ key: attr.key, value: attr.value })
      }
    }

    // 감사: requestorOrgId 기록
    this.auditLog.push({
      action: 'identity.verify',
      timestamp: new Date().toISOString(),
      detail: `${request.identityId} by ${request.requestorOrgId} for ${request.purpose}`,
    })

    return { identityId: request.identityId, isValid, verificationLevel: identity.verificationLevel, disclosedAttributes, maskedAttributes, expiryStatus }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
