// Design Ref: §R261 — 공급망 위험 점수 엔진
// Plan SC: SVC-AI-ADV-R261-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Vendor {
  vendorId: string
  name: string
  country: string
  category: string
  certifications: string[]
  cveCount: number
  incidentCount: number
  financialStability: number // 0~100, 높을수록 안정
}

export interface RiskScore {
  vendorId: string
  score: number
  level: RiskLevel
  factors: string[]
}

export interface RiskSummary {
  totalVendors: number
  byLevel: Record<RiskLevel, number>
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

const REQUIRED_CERTS = ['ISO27001', 'SOC2']

export class SupplyChainRiskScorer {
  private vendors = new Map<string, Vendor>()
  private highRiskCountries = new Set<string>()
  private auditLog: AuditEntry[] = []

  registerVendor(vendor: Vendor, caller: string, grade: DataGrade): void {
    this.assertOpen(grade)
    if (vendor.cveCount < 0 || vendor.incidentCount < 0) {
      throw new Error('cveCount/incidentCount는 0 이상이어야 합니다')
    }
    if (vendor.financialStability < 0 || vendor.financialStability > 100) {
      throw new Error('financialStability 범위 0~100')
    }
    if (this.vendors.has(vendor.vendorId)) {
      throw new Error(`중복 vendor: ${vendor.vendorId}`)
    }
    this.vendors.set(vendor.vendorId, { ...vendor, certifications: [...vendor.certifications] })
    this.appendAudit('vendor.register', this.mask(caller), {
      vendorId: this.mask(vendor.vendorId),
      category: vendor.category,
    })
  }

  addHighRiskCountry(country: string): void {
    this.highRiskCountries.add(country)
    this.appendAudit('country.add', 'SYSTEM', { country })
  }

  removeHighRiskCountry(country: string): void {
    this.highRiskCountries.delete(country)
    this.appendAudit('country.remove', 'SYSTEM', { country })
  }

  computeScore(vendorId: string): RiskScore {
    const vendor = this.vendors.get(vendorId)
    if (!vendor) throw new Error(`Unknown vendor: ${vendorId}`)

    const factors: string[] = []
    let score = 0

    const cvePart = Math.min(vendor.cveCount * 3, 30)
    if (cvePart > 0) {
      factors.push(`CVE ${vendor.cveCount}건(+${cvePart})`)
      score += cvePart
    }

    const incPart = Math.min(vendor.incidentCount * 5, 25)
    if (incPart > 0) {
      factors.push(`사고 ${vendor.incidentCount}건(+${incPart})`)
      score += incPart
    }

    if (vendor.financialStability < 50) {
      factors.push('재정 불안정(+20)')
      score += 20
    }

    if (this.highRiskCountries.has(vendor.country)) {
      factors.push(`고위험 국가 ${vendor.country}(+15)`)
      score += 15
    }

    const hasAllCerts = REQUIRED_CERTS.every((c) => vendor.certifications.includes(c))
    if (!hasAllCerts) {
      factors.push('필수 인증 누락(+10)')
      score += 10
    }

    const level = this.levelFromScore(score)
    this.appendAudit('score.compute', 'SYSTEM', {
      vendorId: this.mask(vendorId),
      score,
      level,
    })
    return { vendorId, score, level, factors }
  }

  recommendAlternatives(vendorId: string): RiskScore[] {
    const target = this.vendors.get(vendorId)
    if (!target) throw new Error(`Unknown vendor: ${vendorId}`)
    const currentScore = this.computeScore(vendorId).score

    const candidates: RiskScore[] = []
    for (const [id, v] of this.vendors.entries()) {
      if (id === vendorId) continue
      if (v.category !== target.category) continue
      const s = this.computeScore(id)
      if (s.score < currentScore) {
        candidates.push(s)
      }
    }
    candidates.sort((a, b) => a.score - b.score)
    return candidates.slice(0, 3)
  }

  getSummary(): RiskSummary {
    const byLevel: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
    for (const id of this.vendors.keys()) {
      const s = this.computeScore(id)
      byLevel[s.level]++
    }
    return { totalVendors: this.vendors.size, byLevel }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private levelFromScore(score: number): RiskLevel {
    if (score < 25) return 'LOW'
    if (score < 50) return 'MEDIUM'
    if (score < 75) return 'HIGH'
    return 'CRITICAL'
  }

  private assertOpen(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터 전송 금지 (N2SF N-05)`)
    }
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(action: string, callerMasked: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
