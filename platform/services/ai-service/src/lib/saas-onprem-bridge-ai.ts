/**
 * AI 기반 SaaS↔온프레미스 브릿지 — SVC-AI-ADV-R144
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R144/SVC-AI-ADV-R144.plan.md
 * Plan SC: FR-R144.1 ~ FR-R144.6
 *
 * 하이브리드 배포 환경 자동 동기화 + 데이터 일관성 보장.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export type SyncDirection = 'SAAS_TO_ONPREM' | 'ONPREM_TO_SAAS' | 'BIDIRECTIONAL'
export type ConflictStrategy = 'SAAS_WINS' | 'ONPREM_WINS' | 'LATEST_WINS' | 'MANUAL'

export interface SyncConfig {
  entityType: string
  direction: SyncDirection
  conflictStrategy: ConflictStrategy
  grade: DataGrade
  batchSize: number
}

export interface EntityRecord {
  id: string
  entityType: string
  data: Record<string, unknown>
  updatedAt: string
  source: 'SAAS' | 'ONPREM'
  grade: DataGrade
  checksum: string
}

export type SyncStatus = 'SYNCED' | 'CONFLICT' | 'PENDING' | 'FAILED'

export interface SyncResult {
  entityType: string
  processed: number
  synced: number
  conflicts: number
  failed: number
  conflictDetails: Array<{ id: string; strategy: ConflictStrategy; resolved: boolean }>
  duration: SyncStatus
  timestamp: string
}

export interface ConsistencyReport {
  entityType: string
  saasCount: number
  onpremCount: number
  matchedCount: number
  divergedCount: number
  consistencyPercent: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

function simpleChecksum(data: Record<string, unknown>): string {
  const str = JSON.stringify(data, Object.keys(data).sort())
  let h = 0
  for (const ch of str) { h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff }
  return h.toString(16)
}

export class SaasOnpremBridgeAi {
  private readonly configs = new Map<string, SyncConfig>()
  private readonly saasStore = new Map<string, EntityRecord>()
  private readonly onpremStore = new Map<string, EntityRecord>()
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] { return this.auditLog }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R144.1
  registerSyncConfig(config: SyncConfig): void {
    if (config.grade === DataGrade.C || config.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${config.grade}등급 동기화 설정 금지 (N2SF N-05)`)
    }
    this.configs.set(config.entityType, config)
    this.audit('registerSyncConfig', { entityType: config.entityType, direction: config.direction })
  }

  // Plan SC: FR-R144.2
  upsertRecord(record: EntityRecord): void {
    if (record.grade === DataGrade.C || record.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${record.grade}등급 레코드 저장 금지 (N2SF N-05)`)
    }
    const key = `${record.entityType}:${record.id}`
    const computed = simpleChecksum(record.data)
    const stored = { ...record, checksum: computed }
    if (record.source === 'SAAS') {
      this.saasStore.set(key, stored)
    } else {
      this.onpremStore.set(key, stored)
    }
    this.audit('upsertRecord', { id: record.id, source: record.source, entityType: record.entityType })
  }

  // Plan SC: FR-R144.3 — conflict resolution
  private resolveConflict(
    saas: EntityRecord,
    onprem: EntityRecord,
    strategy: ConflictStrategy,
  ): { winner: EntityRecord; resolved: boolean } {
    if (strategy === 'SAAS_WINS') return { winner: saas, resolved: true }
    if (strategy === 'ONPREM_WINS') return { winner: onprem, resolved: true }
    if (strategy === 'LATEST_WINS') {
      const winner = new Date(saas.updatedAt) >= new Date(onprem.updatedAt) ? saas : onprem
      return { winner, resolved: true }
    }
    return { winner: saas, resolved: false } // MANUAL requires human intervention
  }

  // Plan SC: FR-R144.4, FR-R144.5
  sync(entityType: string): SyncResult {
    const config = this.configs.get(entityType)
    if (!config) throw new Error(`no sync config for entityType: ${entityType}`)

    const saasEntries = [...this.saasStore.entries()].filter(([k]) => k.startsWith(`${entityType}:`))
    const onpremEntries = [...this.onpremStore.entries()].filter(([k]) => k.startsWith(`${entityType}:`))

    const allIds = new Set([
      ...saasEntries.map(([k]) => k.split(':')[1]!),
      ...onpremEntries.map(([k]) => k.split(':')[1]!),
    ])

    let synced = 0
    let conflicts = 0
    let failed = 0
    const conflictDetails: SyncResult['conflictDetails'] = []

    for (const id of allIds) {
      const key = `${entityType}:${id}`
      const saas = this.saasStore.get(key)
      const onprem = this.onpremStore.get(key)

      if (saas && onprem && saas.checksum !== onprem.checksum) {
        conflicts++
        const { winner, resolved } = this.resolveConflict(saas, onprem, config.conflictStrategy)
        conflictDetails.push({ id, strategy: config.conflictStrategy, resolved })
        if (resolved) {
          if (config.direction === 'SAAS_TO_ONPREM' || config.direction === 'BIDIRECTIONAL') {
            this.onpremStore.set(key, { ...winner, source: 'ONPREM' })
          }
          if (config.direction === 'ONPREM_TO_SAAS' || config.direction === 'BIDIRECTIONAL') {
            this.saasStore.set(key, { ...winner, source: 'SAAS' })
          }
          synced++
        } else {
          failed++
        }
      } else if (saas && !onprem && (config.direction === 'SAAS_TO_ONPREM' || config.direction === 'BIDIRECTIONAL')) {
        this.onpremStore.set(key, { ...saas, source: 'ONPREM' })
        synced++
      } else if (onprem && !saas && (config.direction === 'ONPREM_TO_SAAS' || config.direction === 'BIDIRECTIONAL')) {
        this.saasStore.set(key, { ...onprem, source: 'SAAS' })
        synced++
      } else {
        synced++
      }
    }

    this.audit('sync', { entityType, synced, conflicts, failed })
    return {
      entityType,
      processed: allIds.size,
      synced,
      conflicts,
      failed,
      conflictDetails,
      duration: failed > 0 ? 'FAILED' : conflicts > 0 ? 'CONFLICT' : 'SYNCED',
      timestamp: new Date().toISOString(),
    }
  }

  // Plan SC: FR-R144.6
  checkConsistency(entityType: string): ConsistencyReport {
    const saasKeys = new Set([...this.saasStore.keys()].filter(k => k.startsWith(`${entityType}:`)))
    const onpremKeys = new Set([...this.onpremStore.keys()].filter(k => k.startsWith(`${entityType}:`)))
    const allKeys = new Set([...saasKeys, ...onpremKeys])
    let matchedCount = 0
    let divergedCount = 0
    for (const key of allKeys) {
      const s = this.saasStore.get(key)
      const o = this.onpremStore.get(key)
      if (s && o && s.checksum === o.checksum) matchedCount++
      else divergedCount++
    }
    const consistencyPercent = allKeys.size > 0 ? Math.round((matchedCount / allKeys.size) * 100) : 100
    this.audit('checkConsistency', { entityType, consistencyPercent })
    return {
      entityType,
      saasCount: saasKeys.size,
      onpremCount: onpremKeys.size,
      matchedCount,
      divergedCount,
      consistencyPercent,
    }
  }
}
