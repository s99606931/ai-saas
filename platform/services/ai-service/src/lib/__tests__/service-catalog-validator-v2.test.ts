// Plan SC: SVC-AI-ADV-R525-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceCatalogValidatorV2, type CatalogService } from '../service-catalog-validator-v2'

describe('ServiceCatalogValidatorV2', () => {
  let validator: ServiceCatalogValidatorV2

  const validService: CatalogService = {
    serviceId: 'SVC-1',
    name: '민원 처리 서비스',
    version: '1.0.0',
    status: 'ACTIVE',
    owner: 'team@gov.kr',
    description: '시민 민원을 자동으로 처리하는 AI 서비스입니다.',
    slaTarget: 99.9,
    apiEndpoints: ['/api/v1/civil'],
    dependencies: [],
    tags: ['민원', 'AI'],
    lastReviewedDaysAgo: 100,
  }

  beforeEach(() => {
    validator = new ServiceCatalogValidatorV2()
  })

  it('미등록 서비스 검증 시 오류 발생', () => {
    expect(() => validator.validate('UNKNOWN')).toThrow('Unknown service')
  })

  it('완전한 서비스 → isValid=true', () => {
    validator.registerService(validService)
    const report = validator.validate('SVC-1')
    expect(report.isValid).toBe(true)
    expect(report.issues.filter((i) => i.severity === 'ERROR' || i.severity === 'CRITICAL')).toHaveLength(0)
  })

  it('오너 미지정 → CRITICAL 이슈, isValid=false', () => {
    validator.registerService({ ...validService, serviceId: 'SVC-NOOWN', owner: '' })
    const report = validator.validate('SVC-NOOWN')
    expect(report.issues.some((i) => i.severity === 'CRITICAL' && i.field === 'owner')).toBe(true)
    expect(report.isValid).toBe(false)
  })

  it('설명 10자 미만 → ERROR 이슈', () => {
    validator.registerService({ ...validService, serviceId: 'SVC-NODESC', description: '짧음' })
    const report = validator.validate('SVC-NODESC')
    expect(report.issues.some((i) => i.severity === 'ERROR' && i.field === 'description')).toBe(true)
  })

  it('SLA 목표 99% 미달 → WARNING 이슈', () => {
    validator.registerService({ ...validService, serviceId: 'SVC-LOWSLA', slaTarget: 95 })
    const report = validator.validate('SVC-LOWSLA')
    expect(report.issues.some((i) => i.severity === 'WARNING' && i.field === 'slaTarget')).toBe(true)
  })

  it('미등록 의존 서비스 → ERROR 이슈', () => {
    validator.registerService({ ...validService, serviceId: 'SVC-DEP', dependencies: ['MISSING-SVC'] })
    const report = validator.validate('SVC-DEP')
    expect(report.issues.some((i) => i.field === 'dependencies' && i.severity === 'ERROR')).toBe(true)
  })

  it('validationScore: ERROR 많을수록 낮아짐', () => {
    validator.registerService({ ...validService, serviceId: 'SVC-LOW', owner: '', description: '짧음' })
    const report = validator.validate('SVC-LOW')
    expect(report.validationScore).toBeLessThan(100)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    validator.registerService(validService)
    validator.validate('SVC-1')
    const log1 = validator.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = validator.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
