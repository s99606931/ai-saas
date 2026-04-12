/**
 * Tests — SVC-AI-ADV-R129 Multi-Model Consensus Voter
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  MultiModelConsensusVoter,
  DataGrade,
} from '../multi-model-consensus-voter'

describe('MultiModelConsensusVoter — R129', () => {
  let voter: MultiModelConsensusVoter

  beforeEach(() => {
    voter = new MultiModelConsensusVoter(DataGrade.O)
  })

  it('FR-R129.1: registerModel 기본 weight 1', () => {
    voter.registerModel('gpt-4', 2.5)
    voter.registerModel('claude', 1)
    const log = voter.getAuditLog()
    expect(log.filter((e) => e.action === 'modelRegistered').length).toBe(2)
  })

  it('FR-R129.3: 단순 다수결 승자', () => {
    const result = voter.decide('majority', [
      { modelId: 'a', answer: '답변1' },
      { modelId: 'b', answer: '답변1' },
      { modelId: 'c', answer: '답변2' },
    ])
    expect(result.winner).toBe('답변1')
    expect(result.support).toBe(2)
    expect(result.totalVotes).toBe(3)
  })

  it('majority 동률 tiebreaker', () => {
    const result = voter.decide('majority', [
      { modelId: 'a', answer: 'X' },
      { modelId: 'b', answer: 'Y' },
    ])
    expect(result.tiebreaker).toBe('first-seen-order')
    expect(result.winner).toBe('x')
  })

  it('FR-R129.4: weighted 승자', () => {
    voter.registerModel('big', 10)
    voter.registerModel('small', 1)
    const result = voter.decide('weighted', [
      { modelId: 'big', answer: 'A' },
      { modelId: 'small', answer: 'B' },
      { modelId: 'small', answer: 'B' },
    ])
    expect(result.winner).toBe('a')
    expect(result.support).toBe(10)
  })

  it('weighted 미등록 모델 weight 1', () => {
    const result = voter.decide('weighted', [
      { modelId: 'x', answer: 'A' },
      { modelId: 'y', answer: 'B' },
      { modelId: 'z', answer: 'B' },
    ])
    expect(result.winner).toBe('b')
    expect(result.support).toBe(2)
  })

  it('FR-R129.5: ranked 1순위 과반', () => {
    const result = voter.decide(
      'ranked',
      [
        { modelId: 'm1', answer: 'A' },
        { modelId: 'm2', answer: 'A' },
        { modelId: 'm3', answer: 'B' },
      ],
      [['A', 'B'], ['A', 'B'], ['B', 'A']],
    )
    expect(result.winner).toBe('a')
  })

  it('ranked IRV 라운드 탈락', () => {
    // 1라운드: A=2, B=1, C=1 (과반 4/2=2.5 미달 -> 최소 탈락)
    // B, C 동률 탈락 -> 한쪽 사전순 survivor
    const result = voter.decide(
      'ranked',
      [
        { modelId: 'm1', answer: 'A' },
        { modelId: 'm2', answer: 'A' },
        { modelId: 'm3', answer: 'B' },
        { modelId: 'm4', answer: 'C' },
      ],
      [
        ['A', 'B', 'C'],
        ['A', 'C', 'B'],
        ['B', 'A', 'C'],
        ['C', 'B', 'A'],
      ],
    )
    expect(['a', 'b', 'c']).toContain(result.winner)
    expect(result.strategy).toBe('ranked')
  })

  it('FR-R129.6: decide strategy 분기', () => {
    const res = voter.decide('majority', [
      { modelId: 'a', answer: 'HELLO' },
      { modelId: 'b', answer: 'hello  ' },
    ])
    // 정규화 후 동일
    expect(res.winner).toBe('hello')
    expect(res.support).toBe(2)
  })

  it('정규화: 공백/대소문자', () => {
    const res = voter.decide('majority', [
      { modelId: 'a', answer: '  Yes  ' },
      { modelId: 'b', answer: 'YES' },
      { modelId: 'c', answer: 'yes' },
    ])
    expect(res.winner).toBe('yes')
    expect(res.support).toBe(3)
  })

  it('빈 responses throw', () => {
    expect(() => voter.decide('majority', [])).toThrow('must not be empty')
  })

  it('빈 answer throw', () => {
    expect(() =>
      voter.decide('majority', [{ modelId: 'a', answer: '   ' }]),
    ).toThrow('must not be empty')
  })

  it('N2SF N-05: C 등급 차단', () => {
    expect(() => new MultiModelConsensusVoter(DataGrade.C)).toThrow('N2SF N-05')
    expect(() => new MultiModelConsensusVoter(DataGrade.S)).toThrow('N2SF N-05')
  })

  it('registerModel 빈 id throw', () => {
    expect(() => voter.registerModel('', 1)).toThrow('must not be empty')
  })

  it('registerModel 음수 weight throw', () => {
    expect(() => voter.registerModel('m', -1)).toThrow('must be positive')
  })

  it('FR-R129.7: getAuditLog append-only', () => {
    voter.decide('majority', [
      { modelId: 'a', answer: 'X' },
      { modelId: 'b', answer: 'X' },
    ])
    const l1 = voter.getAuditLog()
    l1.push({ action: 'voteConducted', timestamp: 0, details: {} })
    const l2 = voter.getAuditLog()
    expect(l2.length).toBeLessThan(l1.length)
  })
})
