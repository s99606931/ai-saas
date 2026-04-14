/**
 * AI-Driven SLA Negotiator V2 — SVC-AI-ADV-R655 (트랙 A 24차)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R655.design.md
 * Plan SC: FR-R655.1 ~ FR-R655.6
 *
 * 공공-민간 SLA 자동 협상 + 점수 + 합의 판정.
 * N2SF N-05: C/S 등급 차단. PII SHA-256 마스킹.
 */

import { createHash } from 'crypto'

export type DataGrade = 'C' | 'S' | 'O'
export type Party = 'public' | 'vendor'

export interface SLATerms {
  availability: number // 0~1
  responseMs: number
  pricePerMonth: number
}

export interface SLAProposal {
  proposalId: string
  party: Party
  terms: SLATerms
  contactEmail: string
  contactName: string
  grade: DataGrade
  createdAt: string
}

export interface NegotiationRound {
  proposalId: string
  party: Party
  counterTerms: SLATerms
  timestamp: string
}

export interface ScoreResult {
  proposalId: string
  score: number
  details: { availabilityScore: number; responseScore: number; priceScore: number }
}

export interface AgreementResult {
  proposalId: string
  agreed: boolean
  finalScore: number
  acceptedBy: Party[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  proposalId: string
  detail: Record<string, unknown>
}

const MAX_RESPONSE_MS = 5000
const MAX_PRICE = 100_000_000
const AGREE_THRESHOLD = 0.7

export class AIDrivenSLANegotiatorV2 {
  private readonly proposals = new Map<string, SLAProposal>()
  private readonly rounds = new Map<string, NegotiationRound[]>()
  private readonly accepts = new Map<string, Set<Party>>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R655.1 + FR-R655.5
  proposeSLA(
    proposalId: string,
    party: Party,
    terms: SLATerms,
    contactEmail: string,
    contactName: string,
    grade: DataGrade = 'O',
  ): SLAProposal {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (this.proposals.has(proposalId)) {
      throw new Error(`Proposal already exists: ${proposalId}`)
    }
    const proposal: SLAProposal = {
      proposalId,
      party,
      terms: { ...terms },
      contactEmail: this.maskPII(contactEmail),
      contactName: this.maskPII(contactName),
      grade,
      createdAt: new Date().toISOString(),
    }
    this.proposals.set(proposalId, proposal)
    this.rounds.set(proposalId, [])
    this.accepts.set(proposalId, new Set())
    this.appendAudit('proposal.create', proposalId, { party })
    return { ...proposal, terms: { ...proposal.terms } }
  }

  // Plan SC: FR-R655.2
  addRound(proposalId: string, party: Party, counterTerms: SLATerms): NegotiationRound {
    this.requireProposal(proposalId)
    const round: NegotiationRound = {
      proposalId,
      party,
      counterTerms: { ...counterTerms },
      timestamp: new Date().toISOString(),
    }
    this.rounds.get(proposalId)!.push(round)
    this.appendAudit('round.add', proposalId, { party })
    return { ...round, counterTerms: { ...round.counterTerms } }
  }

  // Plan SC: FR-R655.3
  scoreProposal(proposalId: string): ScoreResult {
    const proposal = this.requireProposal(proposalId)
    const rounds = this.rounds.get(proposalId)!
    const last = rounds.length > 0 ? rounds[rounds.length - 1]!.counterTerms : proposal.terms
    const availabilityScore = Math.max(0, Math.min(1, last.availability))
    const responseScore = Math.max(0, 1 - last.responseMs / MAX_RESPONSE_MS)
    const priceScore = Math.max(0, 1 - last.pricePerMonth / MAX_PRICE)
    const score = 0.4 * availabilityScore + 0.3 * responseScore + 0.3 * priceScore
    return {
      proposalId,
      score,
      details: { availabilityScore, responseScore, priceScore },
    }
  }

  // Plan SC: FR-R655.4
  accept(proposalId: string, party: Party): void {
    this.requireProposal(proposalId)
    this.accepts.get(proposalId)!.add(party)
    this.appendAudit('proposal.accept', proposalId, { party })
  }

  evaluateAgreement(proposalId: string): AgreementResult {
    this.requireProposal(proposalId)
    const { score } = this.scoreProposal(proposalId)
    const acceptedBy = [...this.accepts.get(proposalId)!]
    const agreed =
      score >= AGREE_THRESHOLD && acceptedBy.includes('public') && acceptedBy.includes('vendor')
    return { proposalId, agreed, finalScore: score, acceptedBy }
  }

  // Plan SC: FR-R655.6 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private requireProposal(proposalId: string): SLAProposal {
    const p = this.proposals.get(proposalId)
    if (!p) throw new Error(`Unknown proposal: ${proposalId}`)
    return p
  }

  private maskPII(value: string): string {
    return createHash('sha256').update(value).digest('hex').substring(0, 16)
  }

  private appendAudit(action: string, proposalId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, proposalId, detail })
  }
}
