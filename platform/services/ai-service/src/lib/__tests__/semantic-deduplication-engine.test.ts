/**
 * Unit tests for Semantic Deduplication Engine — SVC-AI-ADV-R140
 */

import { describe, it, expect } from 'vitest'
import {
  SemanticDeduplicationEngine,
  type Document,
} from '../semantic-deduplication-engine'

const docs: Document[] = [
  { id: 'd1', text: '공공기관 민원 접수 처리 절차 안내', createdAt: 1000 },
  { id: 'd2', text: '공공기관 민원 접수 처리 절차 안내문', createdAt: 2000 },
  { id: 'd3', text: '전혀 다른 내용의 공지사항 발행합니다', createdAt: 3000 },
  { id: 'd4', text: '공공기관 민원 접수 처리 절차', createdAt: 4000 },
]

describe('SVC-AI-ADV-R140 SemanticDeduplicationEngine', () => {
  it('[FR-R140.1] tokenizes lowercased words', () => {
    const e = new SemanticDeduplicationEngine()
    const tokens = e.tokenize('Hello  WORLD, test!')
    expect(tokens).toEqual(['hello', 'world', 'test'])
  })

  it('[FR-R140.1] ngrams produces 3-grams', () => {
    const e = new SemanticDeduplicationEngine({ ngramSize: 2 })
    const grams = e.ngrams(['a', 'b', 'c'])
    expect(grams.has('a b')).toBe(true)
    expect(grams.has('b c')).toBe(true)
    expect(grams.size).toBe(2)
  })

  it('[FR-R140.1] ngrams handles short token list', () => {
    const e = new SemanticDeduplicationEngine({ ngramSize: 5 })
    const grams = e.ngrams(['a', 'b'])
    expect(grams.has('a b')).toBe(true)
  })

  it('[FR-R140.2] jaccard computes set similarity', () => {
    const e = new SemanticDeduplicationEngine()
    const a = new Set(['a', 'b', 'c'])
    const b = new Set(['b', 'c', 'd'])
    expect(e.jaccard(a, b)).toBeCloseTo(2 / 4, 5)
  })

  it('[FR-R140.2] jaccard returns 1 for both empty', () => {
    const e = new SemanticDeduplicationEngine()
    expect(e.jaccard(new Set(), new Set())).toBe(1)
  })

  it('[FR-R140.2] jaccard returns 0 for disjoint', () => {
    const e = new SemanticDeduplicationEngine()
    expect(e.jaccard(new Set(['x']), new Set(['y']))).toBe(0)
  })

  it('[FR-R140.3] clusters similar documents', () => {
    const e = new SemanticDeduplicationEngine({ threshold: 0.3, ngramSize: 2 })
    const result = e.deduplicate(docs)
    // d1,d2,d4는 유사 / d3는 단독
    const clusterWithD1 = result.clusters.find((c) => c.memberIds.includes('d1'))!
    expect(clusterWithD1.memberIds.length).toBeGreaterThanOrEqual(2)
    const clusterWithD3 = result.clusters.find((c) => c.memberIds.includes('d3'))!
    expect(clusterWithD3.memberIds).toEqual(['d3'])
  })

  it('[FR-R140.3] totalDuplicates counts members - clusters', () => {
    const e = new SemanticDeduplicationEngine({ threshold: 0.2, ngramSize: 2 })
    const result = e.deduplicate(docs)
    expect(result.totalDuplicates).toBeGreaterThanOrEqual(1)
  })

  it('[FR-R140.3] handles empty input', () => {
    const e = new SemanticDeduplicationEngine()
    const result = e.deduplicate([])
    expect(result.clusters).toEqual([])
    expect(result.totalDuplicates).toBe(0)
  })

  it('[FR-R140.4] selects longest as representative', () => {
    const e = new SemanticDeduplicationEngine()
    const rep = e.selectRepresentative([
      { id: 'a', text: 'short', createdAt: 100 },
      { id: 'b', text: 'much longer text here', createdAt: 50 },
    ])
    expect(rep.id).toBe('b')
  })

  it('[FR-R140.4] tiebreaks on createdAt when lengths equal', () => {
    const e = new SemanticDeduplicationEngine()
    const rep = e.selectRepresentative([
      { id: 'a', text: 'hello', createdAt: 100 },
      { id: 'b', text: 'world', createdAt: 200 },
    ])
    expect(rep.id).toBe('b')
  })

  it('[FR-R140.5] getAuditLog records deduplication', () => {
    const e = new SemanticDeduplicationEngine({ now: () => 9000 })
    e.deduplicate(docs)
    const logs = e.getAuditLog()
    expect(logs).toHaveLength(1)
    expect(logs[0]!.event).toBe('dedup.completed')
    expect(logs[0]!.at).toBe(9000)
  })

  it('[FR-R140.6] blocks C/S grade', () => {
    const e = new SemanticDeduplicationEngine()
    expect(() => e.deduplicate(docs, 'C')).toThrow(/BLOCKED/)
    expect(() => e.deduplicate(docs, 'S')).toThrow(/BLOCKED/)
  })
})
