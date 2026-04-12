/**
 * AI Service Catalog Manager — SVC-AI-ADV-R164
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R164.design.md
 * Plan SC: FR-R164.1 ~ FR-R164.8
 *
 * AI 서비스 카탈로그 + 접근제어 관리자.
 */

export type DataGrade = 'O' | 'C' | 'S'
export type RequestStatus = 'pending' | 'approved' | 'rejected'

export interface CatalogServiceInput {
  name: string
  category: string
  tags: string[]
  description: string
}

export interface CatalogService {
  id: string
  name: string
  category: string
  tags: string[]
  description: string
  owner: string
  registeredAt: number
}

export interface CatalogSummary {
  id: string
  name: string
  category: string
  tags: string[]
}

export interface AccessRequest {
  id: number
  serviceId: string
  userId: string
  status: RequestStatus
  approvedBy?: string
  at: number
}

export interface CatalogStats {
  totalServices: number
  pendingRequests: number
  approvedRequests: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface CatalogOptions {
  now?: () => number
}

export class AiServiceCatalogManagerR164 {
  private readonly services = new Map<string, CatalogService>()
  private readonly requests = new Map<number, AccessRequest>()
  private readonly approvals = new Set<string>() // `${serviceId}|${userId}`
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number
  private reqCounter = 0

  constructor(opts: CatalogOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R164.1: 서비스 등록 */
  register(
    service: CatalogServiceInput,
    owner: string,
    grade: DataGrade = 'O',
  ): CatalogService {
    this.assertGrade(grade)
    if (!service.name || !service.category) {
      throw new Error('invalid_service')
    }
    const id = this.slug(service.name)
    if (this.services.has(id)) {
      this.audit('duplicate_service', { id })
      throw new Error('duplicate_service')
    }
    const entry: CatalogService = {
      id,
      name: service.name,
      category: service.category,
      tags: [...service.tags],
      description: service.description,
      owner,
      registeredAt: this.now(),
    }
    this.services.set(id, entry)
    this.audit('registered', { id, owner })
    return entry
  }

  /** FR-R164.2: 검색 */
  discover(query: {
    text?: string
    category?: string
    tag?: string
  } = {}): CatalogSummary[] {
    const result: CatalogSummary[] = []
    for (const svc of this.services.values()) {
      if (query.category && svc.category !== query.category) continue
      if (query.tag && !svc.tags.includes(query.tag)) continue
      if (query.text) {
        const needle = query.text.toLowerCase()
        const hay = (svc.name + ' ' + svc.description).toLowerCase()
        if (!hay.includes(needle)) continue
      }
      result.push({
        id: svc.id,
        name: svc.name,
        category: svc.category,
        tags: [...svc.tags],
      })
    }
    return result
  }

  /** FR-R164.5: 승인된 사용자만 상세 조회 */
  getService(serviceId: string, userId: string): CatalogService {
    const svc = this.services.get(serviceId)
    if (!svc) throw new Error('service_not_found')
    if (svc.owner !== userId && !this.approvals.has(this.key(serviceId, userId))) {
      this.audit('access_denied', { serviceId, userId })
      throw new Error('access_denied')
    }
    return { ...svc, tags: [...svc.tags] }
  }

  /** FR-R164.3: 접근 요청 */
  requestAccess(serviceId: string, userId: string): AccessRequest {
    if (!this.services.has(serviceId)) {
      throw new Error('service_not_found')
    }
    const id = ++this.reqCounter
    const req: AccessRequest = {
      id,
      serviceId,
      userId,
      status: 'pending',
      at: this.now(),
    }
    this.requests.set(id, req)
    this.audit('access_requested', { id, serviceId, userId })
    return req
  }

  /** FR-R164.4: 접근 승인 */
  approveAccess(requestId: number, approver: string): AccessRequest {
    const req = this.requests.get(requestId)
    if (!req) throw new Error('request_not_found')
    if (req.status !== 'pending') throw new Error('invalid_status')
    const svc = this.services.get(req.serviceId)
    if (!svc) throw new Error('service_not_found')
    if (svc.owner !== approver) {
      this.audit('unauthorized_approval', { requestId, approver })
      throw new Error('unauthorized_approver')
    }
    req.status = 'approved'
    req.approvedBy = approver
    this.approvals.add(this.key(req.serviceId, req.userId))
    this.audit('access_approved', { requestId, approver })
    return req
  }

  rejectAccess(requestId: number, approver: string): AccessRequest {
    const req = this.requests.get(requestId)
    if (!req) throw new Error('request_not_found')
    const svc = this.services.get(req.serviceId)
    if (!svc || svc.owner !== approver) throw new Error('unauthorized_approver')
    req.status = 'rejected'
    req.approvedBy = approver
    this.audit('access_rejected', { requestId, approver })
    return req
  }

  getStats(): CatalogStats {
    let pending = 0
    let approved = 0
    for (const r of this.requests.values()) {
      if (r.status === 'pending') pending += 1
      if (r.status === 'approved') approved += 1
    }
    return {
      totalServices: this.services.size,
      pendingRequests: pending,
      approvedRequests: approved,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private slug(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  private key(serviceId: string, userId: string): string {
    return `${serviceId}|${userId}`
  }

  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      this.audit('grade_blocked', { grade })
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
