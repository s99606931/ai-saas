/**
 * Knowledge Base Change Syncer — SVC-AI-ADV-R147
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R147.design.md
 * Plan SC: FR-R147.1 ~ FR-R147.6
 *
 * KB 문서 변경 감지 및 재임베딩 큐잉.
 */

export type DataGrade = 'O' | 'C' | 'S'
export type KbStatus = 'PENDING' | 'EMBEDDED' | 'TOMBSTONE'

export interface KbDocState {
  docId: string
  contentHash: string
  status: KbStatus
  updatedAt: number
  enqueuedAt?: number
  embeddedAt?: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface SyncerOptions {
  now?: () => number
}

export class KbChangeSyncer {
  private readonly docs = new Map<string, KbDocState>()
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number
  private seq = 0

  constructor(opts: SyncerOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R147.1 ~ FR-R147.2: upsert + 해시 비교 */
  upsert(
    docId: string,
    contentHash: string,
    updatedAt: number,
    grade: DataGrade = 'O',
  ): KbStatus {
    this.assertGrade(grade)
    if (!docId || !contentHash) {
      throw new Error('invalid_input')
    }
    const existing = this.docs.get(docId)
    if (existing && existing.status === 'TOMBSTONE') {
      throw new Error('tombstoned')
    }
    if (!existing) {
      const state: KbDocState = {
        docId,
        contentHash,
        status: 'PENDING',
        updatedAt,
        enqueuedAt: this.nextEnqueue(),
      }
      this.docs.set(docId, state)
      this.audit('doc_created', { docId, status: 'PENDING' })
      return 'PENDING'
    }
    if (existing.contentHash === contentHash) {
      // 해시 동일 → 상태 유지
      this.audit('doc_unchanged', { docId, status: existing.status })
      return existing.status
    }
    // 해시 변경 → PENDING 복귀
    existing.contentHash = contentHash
    existing.status = 'PENDING'
    existing.updatedAt = updatedAt
    existing.enqueuedAt = this.nextEnqueue()
    existing.embeddedAt = undefined
    this.audit('doc_changed', { docId })
    return 'PENDING'
  }

  /** FR-R147.4: 처리 완료 */
  markEmbedded(docId: string): void {
    const state = this.docs.get(docId)
    if (!state) {
      throw new Error('not_found')
    }
    if (state.status !== 'PENDING') {
      throw new Error('invalid_state')
    }
    state.status = 'EMBEDDED'
    state.embeddedAt = this.now()
    this.audit('doc_embedded', { docId })
  }

  /** FR-R147.5: 삭제 → TOMBSTONE */
  delete(docId: string): void {
    const state = this.docs.get(docId)
    if (!state) {
      throw new Error('not_found')
    }
    state.status = 'TOMBSTONE'
    state.embeddedAt = undefined
    state.enqueuedAt = undefined
    this.audit('doc_deleted', { docId })
  }

  /** FR-R147.3: pending 문서 FIFO 조회 */
  pending(limit = 100): KbDocState[] {
    const result: KbDocState[] = []
    for (const state of this.docs.values()) {
      if (state.status === 'PENDING') {
        result.push({ ...state })
      }
    }
    result.sort((a, b) => (a.enqueuedAt ?? 0) - (b.enqueuedAt ?? 0))
    return result.slice(0, limit)
  }

  get(docId: string): KbDocState | undefined {
    const state = this.docs.get(docId)
    return state ? { ...state } : undefined
  }

  /** FR-R147.6: 감사 로그 */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private nextEnqueue(): number {
    this.seq += 1
    return this.seq
  }

  /** FR-R147.6: C/S등급 차단 */
  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
