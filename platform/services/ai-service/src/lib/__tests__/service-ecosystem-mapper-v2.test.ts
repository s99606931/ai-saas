import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceEcosystemMapperV2 } from '../service-ecosystem-mapper-v2'

describe('ServiceEcosystemMapperV2', () => {
  let mapper: ServiceEcosystemMapperV2

  beforeEach(() => {
    mapper = new ServiceEcosystemMapperV2()
  })

  it('노드 등록 후 조회 가능', () => {
    const node = mapper.registerNode('node-1', '민원서비스', 'api')
    expect(node.nodeId).toBe('node-1')
    expect(node.serviceType).toBe('api')
  })

  it('의존성 추가 후 조회', () => {
    mapper.registerNode('node-1', '민원서비스', 'api')
    mapper.registerNode('node-2', 'DB서비스', 'database')
    mapper.addDependency('node-1', 'node-2', 'sync')
    const deps = mapper.getServiceDependencies('node-1')
    expect(deps.length).toBe(1)
    expect(deps[0]!.toId).toBe('node-2')
  })

  it('getHighDependencyNodes: 인바운드 의존성 임계값 이상', () => {
    mapper.registerNode('node-1', '민원서비스', 'api')
    mapper.registerNode('node-2', 'DB서비스', 'database')
    mapper.registerNode('node-3', '알림서비스', 'api')
    mapper.addDependency('node-1', 'node-2', 'sync')
    mapper.addDependency('node-3', 'node-2', 'sync')
    const high = mapper.getHighDependencyNodes(2)
    expect(high.map((n) => n.nodeId)).toContain('node-2')
    expect(high.map((n) => n.nodeId)).not.toContain('node-1')
  })

  it('의존성 없으면 빈 배열', () => {
    mapper.registerNode('node-1', '민원서비스', 'api')
    expect(mapper.getServiceDependencies('node-1')).toHaveLength(0)
  })

  it('C등급 데이터 전송 차단', () => {
    mapper.registerNode('node-1', '민원서비스', 'api')
    mapper.registerNode('node-2', 'DB서비스', 'database')
    expect(() => mapper.addDependency('node-1', 'node-2', 'sync', 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    mapper.registerNode('node-1', '민원서비스', 'api')
    mapper.registerNode('node-2', 'DB서비스', 'database')
    expect(() => mapper.addDependency('node-1', 'node-2', 'sync', 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    mapper.registerNode('node-1', '민원서비스', 'api')
    mapper.registerNode('node-2', 'DB서비스', 'database')
    mapper.addDependency('node-1', 'node-2', 'sync')
    const log = mapper.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(3)
  })
})
