// Design Ref: §설계 결정 — PQC 취약/안전 분류 및 대체 권장
// Plan SC: SVC-AI-ADV-R618
export type DataGrade = 'O' | 'C' | 'S'

export type QuantumRisk = 'HIGH' | 'MEDIUM' | 'SAFE'

export interface CryptoUsage {
  id: string
  algorithm: string
  context: string
}

export interface AdvisoryReport {
  id: string
  algorithm: string
  context: string
  risk: QuantumRisk
  recommendation: string
}

export interface MigrationSummary {
  totalItems: number
  highRiskCount: number
  mediumRiskCount: number
  overallRiskScore: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  details?: Record<string, unknown>
}

interface ClassifyResult {
  risk: QuantumRisk
  recommendation: string
}

function classify(algo: string): ClassifyResult {
  const a = algo.toUpperCase()
  // 양자 취약 (Shor 알고리즘)
  if (/^RSA/.test(a) || a === 'ECDSA' || a === 'ECDH' || a === 'DH' || a === 'DSA') {
    const rec = a === 'ECDSA' || /SIG/.test(a) || /RSA-SIG/.test(a)
      ? 'ML-DSA (Dilithium) 서명으로 전환 권장'
      : 'ML-KEM (Kyber) 키교환으로 전환 권장'
    return { risk: 'HIGH', recommendation: rec }
  }
  // 대칭 (Grover → 실효 비트수 절반)
  if (a === 'AES-128' || a === 'AES128') {
    return { risk: 'MEDIUM', recommendation: 'AES-256로 전환 권장' }
  }
  if (a === 'SHA-1' || a === 'SHA1' || a === 'SHA-256' || a === 'SHA256') {
    if (a.includes('1')) return { risk: 'HIGH', recommendation: 'SHA-384 이상으로 전환' }
    return { risk: 'MEDIUM', recommendation: 'SHA-384 이상 권장' }
  }
  // 양자 안전
  if (
    a === 'AES-256' ||
    a === 'AES256' ||
    a === 'ML-KEM' ||
    a === 'ML-DSA' ||
    a === 'SLH-DSA' ||
    a === 'SHA-384' ||
    a === 'SHA-512'
  ) {
    return { risk: 'SAFE', recommendation: '현 알고리즘 유지' }
  }
  return { risk: 'MEDIUM', recommendation: '알고리즘 재검토 필요 (미분류)' }
}

const RISK_SCORE: Record<QuantumRisk, number> = { HIGH: 100, MEDIUM: 50, SAFE: 0 }

export class QuantumSafeCryptoAdvisorV2 {
  private usages = new Map<string, CryptoUsage>()
  private auditLog: AuditEntry[] = []

  registerUsage(id: string, algorithm: string, context: string, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!id || !algorithm) throw new Error('id와 algorithm은 필수')
    this.usages.set(id, { id, algorithm, context })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'usage.register',
      details: { id, algorithm },
    })
  }

  advise(id: string): AdvisoryReport {
    const u = this.usages.get(id)
    if (!u) throw new Error(`id 없음: ${id}`)
    const { risk, recommendation } = classify(u.algorithm)
    return { id, algorithm: u.algorithm, context: u.context, risk, recommendation }
  }

  adviseAll(): AdvisoryReport[] {
    return Array.from(this.usages.keys()).map((id) => this.advise(id))
  }

  summarize(): MigrationSummary {
    const reports = this.adviseAll()
    const highRiskCount = reports.filter((r) => r.risk === 'HIGH').length
    const mediumRiskCount = reports.filter((r) => r.risk === 'MEDIUM').length
    const overall =
      reports.length === 0
        ? 0
        : reports.reduce((s, r) => s + RISK_SCORE[r.risk], 0) / reports.length
    return {
      totalItems: reports.length,
      highRiskCount,
      mediumRiskCount,
      overallRiskScore: Math.round(overall * 100) / 100,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
