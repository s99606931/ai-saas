/**
 * SLA 자동 협상 엔진 — SVC-AI-ADV-R156
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R156/SVC-AI-ADV-R156.design.md
 * Plan SC: FR-R156.1 ~ FR-R156.5
 *
 * 서비스 수준 요구사항 분석 → 실현 가능 SLA 자동 제안 + 협상 시뮬레이션.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface SLARequirement {
  availabilityPercent: number
  responseTimeMs: number
  rtoMinutes: number
  rpoMinutes: number
}

export interface InfraCapability {
  maxAvailability: number
  minResponseTimeMs: number
  minRtoMinutes: number
  minRpoMinutes: number
}

export type SLATier = 'conservative' | 'standard' | 'aggressive'

export interface SLAProposal {
  tier: SLATier
  availabilityPercent: number
  responseTimeMs: number
  rtoMinutes: number
  rpoMinutes: number
  feasible: boolean
  score: number
}

export interface NegotiationResult {
  clientRequirement: SLARequirement
  proposals: SLAProposal[]
  recommended: SLAProposal
  midpoint: SLARequirement
}

export interface SLAAuditEntry {
  action: 'analyzed' | 'simulated'
  timestamp: number
  details: Record<string, unknown>
}

export class SLAAutoNegotiator {
  private readonly capability: InfraCapability
  private readonly auditLog: SLAAuditEntry[] = []

  constructor(grade: DataGrade, capability: InfraCapability) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 SLA 협상 엔진 사용 금지 (N2SF N-05)`,
      )
    }
    this.validateCapability(capability)
    this.capability = { ...capability }
  }

  /** FR-R156.2 ~ FR-R156.3 */
  analyze(requirement: SLARequirement): NegotiationResult {
    this.validateRequirement(requirement)

    const proposals: SLAProposal[] = [
      this.buildProposal('conservative', requirement),
      this.buildProposal('standard', requirement),
      this.buildProposal('aggressive', requirement),
    ]

    const feasible = proposals.filter((p) => p.feasible)
    const recommended = feasible.length > 0
      ? feasible.reduce((best, p) => p.score > best.score ? p : best)
      : proposals[0]!

    const midpoint = this.computeMidpoint(requirement, {
      availabilityPercent: this.capability.maxAvailability,
      responseTimeMs: this.capability.minResponseTimeMs,
      rtoMinutes: this.capability.minRtoMinutes,
      rpoMinutes: this.capability.minRpoMinutes,
    })

    this.audit('analyzed', {
      availability: requirement.availabilityPercent,
      recommended: recommended.tier,
    })

    return { clientRequirement: requirement, proposals, recommended, midpoint }
  }

  /** FR-R156.4 */
  simulate(client: SLARequirement, provider: SLARequirement): SLARequirement {
    this.validateRequirement(client)
    this.validateRequirement(provider)

    const result = this.computeMidpoint(client, provider)
    this.audit('simulated', { clientAvail: client.availabilityPercent, providerAvail: provider.availabilityPercent })
    return result
  }

  /** FR-R156.5 */
  getAuditLog(): readonly SLAAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private buildProposal(tier: SLATier, req: SLARequirement): SLAProposal {
    const cap = this.capability
    let avail: number
    let respMs: number
    let rto: number
    let rpo: number

    if (tier === 'conservative') {
      avail = Math.min(req.availabilityPercent * 0.9, cap.maxAvailability)
      respMs = Math.max(req.responseTimeMs * 1.2, cap.minResponseTimeMs)
      rto = Math.max(req.rtoMinutes * 1.2, cap.minRtoMinutes)
      rpo = Math.max(req.rpoMinutes * 1.2, cap.minRpoMinutes)
    } else if (tier === 'standard') {
      avail = Math.min((req.availabilityPercent + cap.maxAvailability) / 2, cap.maxAvailability)
      respMs = Math.max((req.responseTimeMs + cap.minResponseTimeMs) / 2, cap.minResponseTimeMs)
      rto = Math.max((req.rtoMinutes + cap.minRtoMinutes) / 2, cap.minRtoMinutes)
      rpo = Math.max((req.rpoMinutes + cap.minRpoMinutes) / 2, cap.minRpoMinutes)
    } else {
      avail = Math.min(cap.maxAvailability, req.availabilityPercent)
      respMs = Math.max(cap.minResponseTimeMs, req.responseTimeMs)
      rto = Math.max(cap.minRtoMinutes, req.rtoMinutes)
      rpo = Math.max(cap.minRpoMinutes, req.rpoMinutes)
    }

    const feasible =
      avail >= req.availabilityPercent * 0.85 &&
      respMs <= req.responseTimeMs * 1.5 &&
      rto <= req.rtoMinutes * 1.5 &&
      rpo <= req.rpoMinutes * 1.5

    let score = 0
    if (avail >= req.availabilityPercent) score += 0.25
    if (respMs <= req.responseTimeMs) score += 0.25
    if (rto <= req.rtoMinutes) score += 0.25
    if (rpo <= req.rpoMinutes) score += 0.25

    return { tier, availabilityPercent: avail, responseTimeMs: respMs, rtoMinutes: rto, rpoMinutes: rpo, feasible, score }
  }

  private computeMidpoint(a: SLARequirement, b: SLARequirement): SLARequirement {
    return {
      availabilityPercent: (a.availabilityPercent + b.availabilityPercent) / 2,
      responseTimeMs: (a.responseTimeMs + b.responseTimeMs) / 2,
      rtoMinutes: (a.rtoMinutes + b.rtoMinutes) / 2,
      rpoMinutes: (a.rpoMinutes + b.rpoMinutes) / 2,
    }
  }

  private validateRequirement(req: SLARequirement): void {
    if (req.availabilityPercent < 0 || req.availabilityPercent > 100) {
      throw new Error('availabilityPercent must be 0~100')
    }
    if (req.responseTimeMs <= 0) throw new Error('responseTimeMs must be > 0')
    if (req.rtoMinutes <= 0) throw new Error('rtoMinutes must be > 0')
    if (req.rpoMinutes <= 0) throw new Error('rpoMinutes must be > 0')
  }

  private validateCapability(cap: InfraCapability): void {
    if (cap.maxAvailability < 0 || cap.maxAvailability > 100) {
      throw new Error('maxAvailability must be 0~100')
    }
  }

  private audit(action: SLAAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
