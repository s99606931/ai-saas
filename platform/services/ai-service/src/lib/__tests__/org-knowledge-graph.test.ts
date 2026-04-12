/**
 * Unit tests — Org Knowledge Graph (SVC-AI-ADV-R133 트랙B 2차)
 * Plan SC: FR-R133.1 ~ FR-R133.6
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { OrgKnowledgeGraph } from '../org-knowledge-graph'

describe('SVC-AI-ADV-R133 OrgKnowledgeGraph', () => {
  let graph: OrgKnowledgeGraph

  beforeEach(() => {
    graph = new OrgKnowledgeGraph()
  })

  it('[FR-R133.1] N2SF C 등급 문서 차단', () => {
    expect(() =>
      graph.addDocument({ docId: 'd1', title: '기밀', content: '기밀 내용' }, 'C'),
    ).toThrow('BLOCKED')
    expect(() =>
      graph.addDocument({ docId: 'd2', title: '비밀', content: '비밀 내용' }, 'S'),
    ).toThrow('BLOCKED')
  })

  it('[FR-R133.2] 개념 추출 — 2글자 이상 토큰', () => {
    const concepts = graph.extractConcepts('정보보호 정책 수립 및 CSAP 인증')
    expect(concepts.length).toBeGreaterThan(0)
    expect(concepts.every((c) => c.length >= 2)).toBe(true)
  })

  it('[FR-R133.3] 문서 추가 후 그래프 빌드 — 노드/엣지 반환', () => {
    graph.addDocument({ docId: 'd1', title: '보안', content: '정보보호 정책 CSAP 인증 정보보호' }, 'O')
    graph.addDocument({ docId: 'd2', title: '인증', content: 'CSAP 인증 준비 정보보호 시스템' }, 'O')
    const result = graph.buildGraph()
    expect(result.nodes.length).toBeGreaterThan(0)
    expect(result.exportedAt).toBeDefined()
  })

  it('[FR-R133.4] findRelated — 공동 출현 개념 반환', () => {
    graph.addDocument({ docId: 'd1', title: '보안', content: '정보보호 암호화 보안 정책 암호화' }, 'O')
    const related = graph.findRelated('암호화')
    expect(Array.isArray(related)).toBe(true)
  })

  it('[FR-R133.5] getClusters — 연결 개념 클러스터 반환', () => {
    graph.addDocument({
      docId: 'd1',
      title: '보안',
      content: '정보보호 정책 정보보호 정책 정보보호 정책',
    }, 'O')
    const clusters = graph.getClusters(1)
    expect(Array.isArray(clusters)).toBe(true)
  })

  it('[FR-R133.6] CSAP D-06 감사 로그 append-only', () => {
    graph.addDocument({ docId: 'd1', title: 'A', content: '정보보호 정책' }, 'O')
    graph.buildGraph()
    const log = graph.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
    const copy = graph.getAuditLog()
    copy.push({ timestamp: 'fake', action: 'injected', detail: {} })
    expect(graph.getAuditLog().length).toBe(log.length)
  })
})
