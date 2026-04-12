/**
 * Audit Evidence Collector — SVC-AI-ADV-R136 (트랙 B 2차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R130-R137-trackB/SVC-AI-ADV-R136.design.md
 * Plan SC: FR-R136.1 ~ FR-R136.5
 *
 * CSAP 79항목 감사 증적 자동 수집 + 정리.
 * 증적 append-only 저장. 외부 API 없음.
 */

// Design Ref: §2 — 타입 정의

export interface Evidence {
  evidenceId: string
  title: string
  type: string
  collectedAt: string
  description?: string
}

export interface CsapItem {
  itemId: string
  domain: string
  description: string
}

export interface ComplianceReport {
  totalItems: number
  satisfiedItems: number
  satisfactionRate: number
  gaps: CsapItem[]
  evidenceMap: Record<string, string[]>
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

// Design Ref: §3.3 기본 CSAP 항목 (D-06/D-08/D-09/D-12 대표 항목)
const DEFAULT_CSAP_ITEMS: CsapItem[] = [
  { itemId: 'D-06-01', domain: 'D-06', description: '침해사고 감사 로그 수집' },
  { itemId: 'D-06-02', domain: 'D-06', description: '감사 로그 무결성 보장' },
  { itemId: 'D-06-03', domain: 'D-06', description: '감사 로그 보존 1년 이상' },
  { itemId: 'D-08-01', domain: 'D-08', description: 'RBAC 접근 통제 구현' },
  { itemId: 'D-08-02', domain: 'D-08', description: 'JWT 토큰 만료 관리' },
  { itemId: 'D-08-03', domain: 'D-08', description: '세션 동시 접속 제한' },
  { itemId: 'D-09-01', domain: 'D-09', description: 'AES-256 저장 암호화' },
  { itemId: 'D-09-02', domain: 'D-09', description: 'TLS 1.3+ 전송 암호화' },
  { itemId: 'D-09-03', domain: 'D-09', description: 'bcrypt 비밀번호 해싱' },
  { itemId: 'D-12-01', domain: 'D-12', description: 'Zod 입력 검증 적용' },
  { itemId: 'D-12-02', domain: 'D-12', description: '매개변수화 SQL 쿼리' },
  { itemId: 'D-12-03', domain: 'D-12', description: '하드코딩 시크릿 금지 검사' },
]

export class AuditEvidenceCollector {
  private readonly evidences = new Map<string, Evidence>()
  private readonly csapItems = new Map<string, CsapItem>()
  private readonly evidenceToItems = new Map<string, Set<string>>()
  private readonly itemToEvidences = new Map<string, Set<string>>()
  private readonly auditLog: AuditEntry[] = []

  constructor() {
    for (const item of DEFAULT_CSAP_ITEMS) {
      this.csapItems.set(item.itemId, item)
    }
  }

  // Plan SC: FR-R136.1
  registerEvidence(evidence: Evidence): void {
    this.evidences.set(evidence.evidenceId, { ...evidence })
    this.evidenceToItems.set(evidence.evidenceId, new Set())
    this.appendAudit('evidence.register', { evidenceId: evidence.evidenceId })
  }

  // Plan SC: FR-R136.2
  mapToCsap(evidenceId: string, csapItemId: string): void {
    if (!this.evidences.has(evidenceId)) {
      throw new Error(`Unknown evidence: ${evidenceId}`)
    }
    if (!this.csapItems.has(csapItemId)) {
      // 동적 항목 등록 허용
      this.csapItems.set(csapItemId, {
        itemId: csapItemId,
        domain: csapItemId.split('-').slice(0, 2).join('-'),
        description: csapItemId,
      })
    }
    const eiSet = this.evidenceToItems.get(evidenceId) ?? new Set()
    eiSet.add(csapItemId)
    this.evidenceToItems.set(evidenceId, eiSet)

    const ieSet = this.itemToEvidences.get(csapItemId) ?? new Set()
    ieSet.add(evidenceId)
    this.itemToEvidences.set(csapItemId, ieSet)
    this.appendAudit('evidence.map', { evidenceId, csapItemId })
  }

  // Plan SC: FR-R136.3 — Design Ref: §3.1 갭 분석
  analyzeGaps(): CsapItem[] {
    const gaps: CsapItem[] = []
    for (const item of this.csapItems.values()) {
      const mapped = this.itemToEvidences.get(item.itemId)
      if (!mapped || mapped.size === 0) {
        gaps.push(item)
      }
    }
    this.appendAudit('gap.analyze', { gapCount: gaps.length })
    return gaps
  }

  // Plan SC: FR-R136.4 — Design Ref: §3.2 충족률
  getComplianceReport(): ComplianceReport {
    const totalItems = this.csapItems.size
    let satisfiedItems = 0
    const evidenceMap: Record<string, string[]> = {}

    for (const item of this.csapItems.values()) {
      const mapped = this.itemToEvidences.get(item.itemId)
      if (mapped && mapped.size > 0) {
        satisfiedItems++
        evidenceMap[item.itemId] = [...mapped]
      } else {
        evidenceMap[item.itemId] = []
      }
    }

    const gaps = this.analyzeGaps()
    const satisfactionRate = totalItems > 0 ? satisfiedItems / totalItems : 0

    return {
      totalItems,
      satisfiedItems,
      satisfactionRate,
      gaps,
      evidenceMap,
    }
  }

  // Plan SC: FR-R136.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
