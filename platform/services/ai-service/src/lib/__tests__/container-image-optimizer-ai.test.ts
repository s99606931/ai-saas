import { describe, it, expect, beforeEach } from 'vitest'
import { ContainerImageOptimizerAi, type ContainerImage } from '../container-image-optimizer-ai'

describe('ContainerImageOptimizerAi', () => {
  let optimizer: ContainerImageOptimizerAi

  const cleanImage: ContainerImage = {
    imageId: 'IMG001',
    name: 'api-service',
    tag: '1.0.0',
    baseImage: 'node:18-alpine',
    sizeMb: 150,
    layers: 8,
    hasRootUser: false,
    hasUnpinnedDeps: false,
    hasSecurityVulns: false,
    unusedPackages: [],
  }

  beforeEach(() => {
    optimizer = new ContainerImageOptimizerAi()
    optimizer.registerImage(cleanImage)
  })

  it('이미지 등록 감사 로그', () => {
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'image.register')).toBe(true)
  })

  it('문제 없는 이미지 → isProductionReady true', () => {
    const plan = optimizer.optimize('IMG001')
    expect(plan.isProductionReady).toBe(true)
    expect(plan.securityScore).toBe(100)
  })

  it('root 사용자 → CRITICAL 권고 + securityScore 감점', () => {
    optimizer.registerImage({ ...cleanImage, imageId: 'IMG002', hasRootUser: true })
    const plan = optimizer.optimize('IMG002')
    expect(plan.recommendations.some((r) => r.action === 'REMOVE_ROOT_USER')).toBe(true)
    expect(plan.securityScore).toBeLessThan(100)
    expect(plan.isProductionReady).toBe(false)
  })

  it('보안 취약점 → CHANGE_BASE_IMAGE CRITICAL', () => {
    optimizer.registerImage({ ...cleanImage, imageId: 'IMG003', hasSecurityVulns: true })
    const plan = optimizer.optimize('IMG003')
    expect(plan.recommendations.some((r) => r.action === 'CHANGE_BASE_IMAGE')).toBe(true)
  })

  it('미사용 패키지 → REMOVE_UNUSED_PACKAGES + sizeSaving 계산', () => {
    optimizer.registerImage({ ...cleanImage, imageId: 'IMG004', unusedPackages: ['curl', 'wget'] })
    const plan = optimizer.optimize('IMG004')
    const rec = plan.recommendations.find((r) => r.action === 'REMOVE_UNUSED_PACKAGES')!
    expect(rec).toBeTruthy()
    expect(rec.estimatedSavingMb).toBeGreaterThan(0)
  })

  it('레이어 10개 초과 → SQUASH_LAYERS 권고', () => {
    optimizer.registerImage({ ...cleanImage, imageId: 'IMG005', layers: 15 })
    const plan = optimizer.optimize('IMG005')
    expect(plan.recommendations.some((r) => r.action === 'SQUASH_LAYERS')).toBe(true)
  })

  it('미등록 이미지 에러', () => {
    expect(() => optimizer.optimize('UNKNOWN')).toThrow()
  })

  it('최적화 후 감사 로그', () => {
    optimizer.optimize('IMG001')
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'image.optimize')).toBe(true)
  })
})
