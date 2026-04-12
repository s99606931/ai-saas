/**
 * Unit tests for SaaS↔OnPrem Bridge AI — SVC-AI-ADV-R144
 */
import { describe, it, expect } from 'vitest'
import { SaasOnpremBridgeAi, DataGrade } from '../saas-onprem-bridge-ai'

const makeConfig = (overrides = {}) => ({
  entityType: 'user',
  direction: 'BIDIRECTIONAL' as const,
  conflictStrategy: 'LATEST_WINS' as const,
  grade: DataGrade.O,
  batchSize: 100,
  ...overrides,
})

const makeRecord = (id: string, source: 'SAAS' | 'ONPREM', updatedAt: string, data = { name: 'Test' }) => ({
  id,
  entityType: 'user',
  data,
  updatedAt,
  source,
  grade: DataGrade.O,
  checksum: '',
})

describe('SVC-AI-ADV-R144 SaasOnpremBridgeAi', () => {
  it('[FR-R144.1] registers sync config', () => {
    const bridge = new SaasOnpremBridgeAi()
    bridge.registerSyncConfig(makeConfig())
    expect(bridge.getAuditLog().some(e => e.action === 'registerSyncConfig')).toBe(true)
  })

  it('[FR-R144.1] blocks C/S grade sync config', () => {
    const bridge = new SaasOnpremBridgeAi()
    expect(() => bridge.registerSyncConfig(makeConfig({ grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => bridge.registerSyncConfig(makeConfig({ grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R144.4] syncs SAAS-only record to ONPREM', () => {
    const bridge = new SaasOnpremBridgeAi()
    bridge.registerSyncConfig(makeConfig({ direction: 'SAAS_TO_ONPREM' }))
    bridge.upsertRecord(makeRecord('u1', 'SAAS', '2026-04-12T10:00:00Z'))
    const result = bridge.sync('user')
    expect(result.synced).toBeGreaterThan(0)
  })

  it('[FR-R144.3] conflict resolved with SAAS_WINS strategy', () => {
    const bridge = new SaasOnpremBridgeAi()
    bridge.registerSyncConfig(makeConfig({ conflictStrategy: 'SAAS_WINS' }))
    bridge.upsertRecord(makeRecord('u1', 'SAAS', '2026-04-12T10:00:00Z', { name: 'SaaS Version' }))
    bridge.upsertRecord(makeRecord('u1', 'ONPREM', '2026-04-12T09:00:00Z', { name: 'OnPrem Version' }))
    const result = bridge.sync('user')
    expect(result.conflicts).toBe(1)
    expect(result.conflictDetails[0]!.resolved).toBe(true)
  })

  it('[FR-R144.3] LATEST_WINS picks newer record', () => {
    const bridge = new SaasOnpremBridgeAi()
    bridge.registerSyncConfig(makeConfig({ conflictStrategy: 'LATEST_WINS' }))
    bridge.upsertRecord(makeRecord('u1', 'SAAS', '2026-04-12T10:00:00Z', { name: 'Newer' }))
    bridge.upsertRecord(makeRecord('u1', 'ONPREM', '2026-04-11T10:00:00Z', { name: 'Older' }))
    const result = bridge.sync('user')
    expect(result.conflictDetails[0]!.resolved).toBe(true)
  })

  it('[FR-R144.6] consistency report shows 100% for matching records', () => {
    const bridge = new SaasOnpremBridgeAi()
    bridge.registerSyncConfig(makeConfig())
    bridge.upsertRecord(makeRecord('u1', 'SAAS', '2026-04-12T10:00:00Z', { name: 'Same' }))
    bridge.upsertRecord(makeRecord('u1', 'ONPREM', '2026-04-12T10:00:00Z', { name: 'Same' }))
    const report = bridge.checkConsistency('user')
    expect(report.matchedCount).toBe(1)
    expect(report.consistencyPercent).toBe(100)
  })

  it('throws sync on unknown entityType', () => {
    const bridge = new SaasOnpremBridgeAi()
    expect(() => bridge.sync('unknown')).toThrow('no sync config')
  })

  it('audit log records sync and checkConsistency', () => {
    const bridge = new SaasOnpremBridgeAi()
    bridge.registerSyncConfig(makeConfig())
    bridge.upsertRecord(makeRecord('u1', 'SAAS', '2026-04-12T10:00:00Z'))
    bridge.sync('user')
    bridge.checkConsistency('user')
    const log = bridge.getAuditLog()
    expect(log.some(e => e.action === 'sync')).toBe(true)
    expect(log.some(e => e.action === 'checkConsistency')).toBe(true)
  })
})
