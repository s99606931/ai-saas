import { describe, it, expect, beforeEach } from 'vitest'
import { DataMeshCoordinatorAIV2 } from '../data-mesh-coordinator-ai-v2'

describe('DataMeshCoordinatorAIV2', () => {
  let mesh: DataMeshCoordinatorAIV2

  beforeEach(() => {
    mesh = new DataMeshCoordinatorAIV2()
  })

  it('N2SF S등급 산물 등록 차단', () => {
    expect(() => mesh.registerProduct('p1', 'tax', '홍길동', true, true, 'S')).toThrow('BLOCKED')
  })

  it('오너 이름 SHA-256 마스킹', () => {
    const p = mesh.registerProduct('p2', 'tax', '홍길동', true, true, 'O')
    expect(p.ownerHash).toMatch(/^[a-f0-9]{16}$/)
  })

  it('순환 의존 차단', () => {
    mesh.registerProduct('p3', 'd', 'a', true, true, 'O')
    mesh.registerProduct('p4', 'd', 'b', true, true, 'O')
    mesh.addDependency('p3', 'p4')
    expect(() => mesh.addDependency('p4', 'p3')).toThrow('Cyclic')
  })

  it('도메인별 산물 조회', () => {
    mesh.registerProduct('p5', 'tax', 'a', true, true, 'O')
    mesh.registerProduct('p6', 'health', 'b', true, true, 'O')
    expect(mesh.listByDomain('tax').length).toBe(1)
    expect(mesh.listByDomain('tax')[0]!.productId).toBe('p5')
  })

  it('거버넌스 점수: 모든 항목 충족 시 1.0', () => {
    mesh.registerProduct('p7', 'd', 'a', true, true, 'O')
    mesh.registerProduct('p8', 'd', 'b', true, true, 'O')
    expect(mesh.governanceScore().score).toBeCloseTo(1, 5)
  })

  it('감사 로그 복사본 반환', () => {
    mesh.registerProduct('p9', 'd', 'a', true, true, 'O')
    const log = mesh.getAuditLog()
    log.push({ timestamp: '', action: 'injected', productId: 'X', detail: {} })
    expect(mesh.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
