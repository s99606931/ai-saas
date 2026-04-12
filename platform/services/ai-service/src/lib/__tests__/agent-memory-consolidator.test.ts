/**
 * Unit tests for Agent Memory Consolidator — SVC-AI-ADV-R114
 */

import { describe, it, expect } from 'vitest'
import {
  AgentMemoryConsolidator,
  DataGrade,
  type MemoryEntry,
} from '../agent-memory-consolidator'

function mk(
  id: string,
  agentId: string,
  keywords: string[],
  content: string,
  confidence = 0.8,
  grade: DataGrade = DataGrade.O,
  ts = Date.now(),
): MemoryEntry {
  return { id, agentId, keywords, content, confidence, grade, timestamp: ts }
}

describe('SVC-AI-ADV-R114 AgentMemoryConsolidator', () => {
  it('[FR-R114.1] 빈 입력은 빈 결과', () => {
    const c = new AgentMemoryConsolidator()
    const { results, stats } = c.consolidate([])
    expect(results.length).toBe(0)
    expect(stats.input).toBe(0)
  })

  it('[FR-R114.2] 유사 키워드 클러스터링', () => {
    const c = new AgentMemoryConsolidator({ similarityThreshold: 0.5 })
    const { results } = c.consolidate([
      mk('1', 'a1', ['csap', 'cert', 'gov'], 'CSAP 인증 절차'),
      mk('2', 'a2', ['csap', 'cert', 'gov'], 'CSAP 인증 절차'),
      mk('3', 'a3', ['docker', 'k8s'], '컨테이너 배포'),
    ])
    expect(results.length).toBe(2)
  })

  it('[FR-R114.3] 신뢰도 기반 병합 — 높은 신뢰도가 content 대표', () => {
    const c = new AgentMemoryConsolidator({ similarityThreshold: 0.5 })
    const { results } = c.consolidate([
      mk('1', 'a1', ['csap'], 'low info', 0.3),
      mk('2', 'a2', ['csap'], 'HIGH confidence info', 0.95),
    ])
    expect(results.length).toBe(1)
    expect(results[0]?.content).toBe('HIGH confidence info')
  })

  it('[FR-R114.4] 충돌 해결 표시', () => {
    const c = new AgentMemoryConsolidator({ similarityThreshold: 0.5 })
    const { results } = c.consolidate([
      mk('1', 'a1', ['csap'], 'content A', 0.8),
      mk('2', 'a2', ['csap'], 'content B', 0.7),
    ])
    expect(results[0]?.conflictResolved).toBe(true)
  })

  it('[FR-R114.5] 에이전트 목록 병합', () => {
    const c = new AgentMemoryConsolidator({ similarityThreshold: 0.5 })
    const { results } = c.consolidate([
      mk('1', 'a1', ['k'], 'x'),
      mk('2', 'a2', ['k'], 'x'),
      mk('3', 'a3', ['k'], 'x'),
    ])
    expect(results[0]?.agents.sort()).toEqual(['a1', 'a2', 'a3'])
  })

  it('[FR-R114.6] 하위 등급 호출자는 C 등급 메모리 차단', () => {
    const c = new AgentMemoryConsolidator({ callerGrade: DataGrade.O })
    const { results, stats } = c.consolidate([
      mk('1', 'a1', ['k'], 'public'),
      mk('2', 'a2', ['sec'], 'secret', 0.8, DataGrade.C),
      mk('3', 'a3', ['top'], 'topsec', 0.8, DataGrade.S),
    ])
    expect(stats.blocked).toBe(2)
    expect(results.length).toBe(1)
  })

  it('[FR-R114.6] 상위 등급 호출자는 C 등급 허용', () => {
    const c = new AgentMemoryConsolidator({ callerGrade: DataGrade.S })
    const { stats } = c.consolidate([
      mk('1', 'a1', ['k'], 'public', 0.8, DataGrade.O),
      mk('2', 'a2', ['sec'], 'secret', 0.8, DataGrade.C),
    ])
    expect(stats.blocked).toBe(0)
  })

  it('[FR-R114.7] 감사 로그 기록', () => {
    const c = new AgentMemoryConsolidator()
    c.consolidate([
      mk('1', 'a1', ['x'], 'a'),
      mk('2', 'a2', ['x'], 'b'),
    ])
    const log = c.getAuditLog()
    expect(log.length).toBeGreaterThan(0)
    expect(log.some((e) => e.action === 'consolidate')).toBe(true)
  })

  it('[NFR-R114.2] 단일 엔트리는 충돌 없음', () => {
    const c = new AgentMemoryConsolidator()
    const { results } = c.consolidate([mk('1', 'a1', ['k'], 'only')])
    expect(results[0]?.conflictResolved).toBe(false)
  })
})
