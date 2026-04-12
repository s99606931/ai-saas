import { describe, it, expect, beforeEach } from 'vitest'
import { ApiVersionMigrationAI } from '../api-version-migration-ai'

describe('ApiVersionMigrationAI', () => {
  let ai: ApiVersionMigrationAI

  beforeEach(() => {
    ai = new ApiVersionMigrationAI()
    ai.registerVersion({
      versionId: 'V1',
      semver: '1.0.0',
      endpoints: [
        { path: '/users', method: 'GET' },
        { path: '/users/:id', method: 'GET' },
        { path: '/users/old', method: 'POST' },
      ],
      releaseDate: '2025-01-01',
    })
    ai.registerVersion({
      versionId: 'V2',
      semver: '2.0.0',
      endpoints: [
        { path: '/users', method: 'GET' },
        { path: '/users/:id', method: 'GET' },
        { path: '/users/new', method: 'POST' },
        { path: '/users/batch', method: 'POST', deprecated: true },
      ],
      releaseDate: '2026-01-01',
    })
  })

  it('존재하지 않는 버전 마이그레이션 시 오류', () => {
    expect(() => ai.generateMigrationPlan('UNKNOWN', 'V2')).toThrow('Unknown version')
  })

  it('마이그레이션 플랜 생성 — 제거/추가 스텝 포함', () => {
    const plan = ai.generateMigrationPlan('V1', 'V2')
    expect(plan.fromVersion).toBe('1.0.0')
    expect(plan.toVersion).toBe('2.0.0')
    expect(plan.steps.some((s) => s.type === 'REMOVE')).toBe(true)
    expect(plan.steps.some((s) => s.type === 'ADD')).toBe(true)
  })

  it('deprecated 엔드포인트 MODIFY 스텝 생성', () => {
    const plan = ai.generateMigrationPlan('V1', 'V2')
    expect(plan.steps.some((s) => s.type === 'MODIFY')).toBe(true)
  })

  it('리스크 수준 계산 — 제거 1개 시 LOW', () => {
    const plan = ai.generateMigrationPlan('V1', 'V2')
    expect(plan.riskLevel).toBe('LOW')
  })

  it('예상 작업 시간 > 0', () => {
    const plan = ai.generateMigrationPlan('V1', 'V2')
    expect(plan.estimatedEffortHours).toBeGreaterThan(0)
  })

  it('감사 로그 복사본 반환', () => {
    ai.generateMigrationPlan('V1', 'V2')
    const log = ai.getAuditLog()
    log.push({ timestamp: '', action: 'injected', detail: {} })
    expect(ai.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
