/**
 * Data Mesh Coordinator AI V2 — SVC-AI-ADV-R658 (트랙 A 24차)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R658.design.md
 * Plan SC: FR-R658.1 ~ FR-R658.6
 *
 * 도메인 분산 데이터 산물 카탈로그 + 거버넌스 점수.
 * N2SF N-05: C/S 등급 차단. PII (오너) SHA-256 마스킹.
 */

import { createHash } from 'crypto'

export type DataGrade = 'C' | 'S' | 'O'

export interface DataProduct {
  productId: string
  domain: string
  ownerHash: string
  hasSLA: boolean
  metadataComplete: boolean
  grade: DataGrade
  registeredAt: string
}

export interface GovernanceScore {
  totalProducts: number
  ownerRate: number
  slaRate: number
  metadataRate: number
  score: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  productId: string
  detail: Record<string, unknown>
}

export class DataMeshCoordinatorAIV2 {
  private readonly products = new Map<string, DataProduct>()
  private readonly dependencies = new Map<string, Set<string>>() // downstream -> upstream set
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R658.1 + FR-R658.5
  registerProduct(
    productId: string,
    domain: string,
    ownerName: string,
    hasSLA: boolean,
    metadataComplete: boolean,
    grade: DataGrade = 'O',
  ): DataProduct {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (this.products.has(productId)) {
      throw new Error(`Product already exists: ${productId}`)
    }
    const product: DataProduct = {
      productId,
      domain,
      ownerHash: this.hashOwner(ownerName),
      hasSLA,
      metadataComplete,
      grade,
      registeredAt: new Date().toISOString(),
    }
    this.products.set(productId, product)
    this.dependencies.set(productId, new Set())
    this.appendAudit('product.register', productId, { domain })
    return { ...product }
  }

  // Plan SC: FR-R658.2 — 순환 차단
  addDependency(downstream: string, upstream: string): void {
    this.requireProduct(downstream)
    this.requireProduct(upstream)
    if (downstream === upstream) {
      throw new Error('Self-dependency not allowed')
    }
    if (this.wouldCycle(upstream, downstream)) {
      throw new Error(`Cyclic dependency: ${downstream} -> ${upstream}`)
    }
    this.dependencies.get(downstream)!.add(upstream)
    this.appendAudit('dependency.add', downstream, { upstream })
  }

  // Plan SC: FR-R658.3
  listByDomain(domain: string): DataProduct[] {
    return [...this.products.values()]
      .filter((p) => p.domain === domain)
      .map((p) => ({ ...p }))
  }

  // Plan SC: FR-R658.4
  governanceScore(): GovernanceScore {
    const total = this.products.size
    if (total === 0) {
      return { totalProducts: 0, ownerRate: 0, slaRate: 0, metadataRate: 0, score: 0 }
    }
    let ownerCount = 0
    let slaCount = 0
    let metaCount = 0
    for (const p of this.products.values()) {
      if (p.ownerHash.length > 0) ownerCount += 1
      if (p.hasSLA) slaCount += 1
      if (p.metadataComplete) metaCount += 1
    }
    const ownerRate = ownerCount / total
    const slaRate = slaCount / total
    const metadataRate = metaCount / total
    const score = (ownerRate + slaRate + metadataRate) / 3
    return { totalProducts: total, ownerRate, slaRate, metadataRate, score }
  }

  // Plan SC: FR-R658.6 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private wouldCycle(start: string, target: string): boolean {
    // start의 의존 체인 (start -> ...)을 따라가다 target을 만나면 cycle.
    const visited = new Set<string>()
    const stack = [start]
    while (stack.length > 0) {
      const cur = stack.pop()!
      if (cur === target) return true
      if (visited.has(cur)) continue
      visited.add(cur)
      const deps = this.dependencies.get(cur)
      if (deps) {
        for (const d of deps) stack.push(d)
      }
    }
    return false
  }

  private requireProduct(productId: string): DataProduct {
    const p = this.products.get(productId)
    if (!p) throw new Error(`Unknown product: ${productId}`)
    return p
  }

  private hashOwner(name: string): string {
    return createHash('sha256').update(name).digest('hex').substring(0, 16)
  }

  private appendAudit(action: string, productId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, productId, detail })
  }
}
