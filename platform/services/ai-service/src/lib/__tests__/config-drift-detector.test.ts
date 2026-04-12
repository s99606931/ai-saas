/**
 * 설정 드리프트 감지기 단위 테스트 — SVC-AI-ADV-R163
 * Plan SC: FR-R163.1 ~ FR-R163.6
 */

import { describe, it, expect } from 'vitest'
import { ConfigDriftDetector, DataGrade } from '../config-drift-detector'

describe('ConfigDriftDetector — R163', () => {
  it('FR-R163.1: 베이스라인 설정 및 audit log', () => {
    const cdd = new ConfigDriftDetector(DataGrade.O)
    cdd.setBaseline('infra', { host: 'localhost', port: 5432 })
    const log = cdd.getAuditLog()
    expect(log[0]?.action).toBe('baselineSet')
    expect(log[0]?.configId).toBe('infra')
  })

  it('FR-R163.3: 드리프트 탐지 — 수정된 필드', () => {
    const cdd = new ConfigDriftDetector(DataGrade.O)
    cdd.setBaseline('app', { host: 'localhost', port: 3000, debug: false })
    const report = cdd.detect('app', { host: 'prod.example.com', port: 3000, debug: false })
    expect(report.changes.some((c) => c.field === 'host' && c.type === 'modified')).toBe(true)
  })

  it('FR-R163.3: 드리프트 탐지 — 추가된 필드', () => {
    const cdd = new ConfigDriftDetector(DataGrade.O)
    cdd.setBaseline('app', { host: 'localhost' })
    const report = cdd.detect('app', { host: 'localhost', newField: 'value' })
    expect(report.changes.some((c) => c.field === 'newField' && c.type === 'added')).toBe(true)
  })

  it('FR-R163.3: 드리프트 탐지 — 삭제된 필드', () => {
    const cdd = new ConfigDriftDetector(DataGrade.O)
    cdd.setBaseline('app', { host: 'localhost', extra: 'val' })
    const report = cdd.detect('app', { host: 'localhost' })
    expect(report.changes.some((c) => c.field === 'extra' && c.type === 'removed')).toBe(true)
  })

  it('FR-R163.4: 보안 위험 분류 — password 필드 high 위험', () => {
    const cdd = new ConfigDriftDetector(DataGrade.O)
    cdd.setBaseline('db', { password: 'oldpass', host: 'localhost' })
    const report = cdd.detect('db', { password: 'newpass', host: 'localhost' })
    const pwChange = report.changes.find((c) => c.field === 'password')
    expect(pwChange?.risk).toBe('high')
    expect(pwChange?.current).toBe('[MASKED]')
    expect(pwChange?.baseline).toBe('[MASKED]')
  })

  it('FR-R163.4: port 필드 medium 위험', () => {
    const cdd = new ConfigDriftDetector(DataGrade.O)
    cdd.setBaseline('app', { port: 3000 })
    const report = cdd.detect('app', { port: 8080 })
    expect(report.changes[0]?.risk).toBe('medium')
  })

  it('FR-R163.5: 화이트리스트 필드 제외', () => {
    const cdd = new ConfigDriftDetector(DataGrade.O)
    cdd.setBaseline('app', { version: '1.0', host: 'localhost' })
    cdd.addWhitelistField('version')
    const report = cdd.detect('app', { version: '2.0', host: 'localhost' })
    expect(report.changes.some((c) => c.field === 'version')).toBe(false)
  })

  it('FR-R163.6: audit log append-only', () => {
    const cdd = new ConfigDriftDetector(DataGrade.O)
    cdd.setBaseline('cfg', { x: 1 })
    const log1 = cdd.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    const log2 = cdd.getAuditLog()
    expect(log2).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new ConfigDriftDetector(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new ConfigDriftDetector(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 configId throw', () => {
    const cdd = new ConfigDriftDetector(DataGrade.O)
    expect(() => cdd.setBaseline('', { x: 1 })).toThrow('must not be empty')
  })

  it('베이스라인 없이 detect throw', () => {
    const cdd = new ConfigDriftDetector(DataGrade.O)
    expect(() => cdd.detect('nope', { x: 1 })).toThrow('no baseline for')
  })
})
