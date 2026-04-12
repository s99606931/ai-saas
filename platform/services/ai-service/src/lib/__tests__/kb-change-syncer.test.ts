/**
 * Tests — SVC-AI-ADV-R147 KB Change Syncer
 */

import { describe, it, expect } from 'vitest'
import { KbChangeSyncer } from '../kb-change-syncer'

function makeSyncer() {
  let t = 1_700_000_000_000
  return new KbChangeSyncer({
    now: () => {
      t += 1
      return t
    },
  })
}

describe('KbChangeSyncer', () => {
  it('최초 upsert → PENDING', () => {
    const s = makeSyncer()
    const status = s.upsert('d1', 'h1', 100)
    expect(status).toBe('PENDING')
  })

  it('동일 해시 upsert → 상태 유지', () => {
    const s = makeSyncer()
    s.upsert('d1', 'h1', 100)
    s.markEmbedded('d1')
    const status = s.upsert('d1', 'h1', 200)
    expect(status).toBe('EMBEDDED')
  })

  it('해시 변경 → PENDING 복귀', () => {
    const s = makeSyncer()
    s.upsert('d1', 'h1', 100)
    s.markEmbedded('d1')
    const status = s.upsert('d1', 'h2', 200)
    expect(status).toBe('PENDING')
  })

  it('markEmbedded 상태 전이', () => {
    const s = makeSyncer()
    s.upsert('d1', 'h1', 100)
    s.markEmbedded('d1')
    expect(s.get('d1')?.status).toBe('EMBEDDED')
  })

  it('delete → TOMBSTONE', () => {
    const s = makeSyncer()
    s.upsert('d1', 'h1', 100)
    s.delete('d1')
    expect(s.get('d1')?.status).toBe('TOMBSTONE')
  })

  it('TOMBSTONE upsert 거부', () => {
    const s = makeSyncer()
    s.upsert('d1', 'h1', 100)
    s.delete('d1')
    expect(() => s.upsert('d1', 'h2', 200)).toThrow('tombstoned')
  })

  it('pending FIFO 순서', () => {
    const s = makeSyncer()
    s.upsert('a', 'ha', 1)
    s.upsert('b', 'hb', 2)
    s.upsert('c', 'hc', 3)
    const pending = s.pending()
    expect(pending.map((p) => p.docId)).toEqual(['a', 'b', 'c'])
  })

  it('pending 은 PENDING만 포함', () => {
    const s = makeSyncer()
    s.upsert('a', 'ha', 1)
    s.upsert('b', 'hb', 2)
    s.markEmbedded('a')
    const pending = s.pending()
    expect(pending.length).toBe(1)
    expect(pending[0]!.docId).toBe('b')
  })

  it('pending limit', () => {
    const s = makeSyncer()
    for (let i = 0; i < 5; i += 1) {
      s.upsert(`d${i}`, `h${i}`, i)
    }
    expect(s.pending(2).length).toBe(2)
  })

  it('존재 없는 markEmbedded 오류', () => {
    const s = makeSyncer()
    expect(() => s.markEmbedded('ghost')).toThrow('not_found')
  })

  it('EMBEDDED 상태에서 markEmbedded 재호출 오류', () => {
    const s = makeSyncer()
    s.upsert('d', 'h', 1)
    s.markEmbedded('d')
    expect(() => s.markEmbedded('d')).toThrow('invalid_state')
  })

  it('빈 입력 거부', () => {
    const s = makeSyncer()
    expect(() => s.upsert('', 'h', 1)).toThrow('invalid_input')
    expect(() => s.upsert('d', '', 1)).toThrow('invalid_input')
  })

  it('C/S등급 차단', () => {
    const s = makeSyncer()
    expect(() => s.upsert('d', 'h', 1, 'C')).toThrow('grade_blocked')
    expect(() => s.upsert('d', 'h', 1, 'S')).toThrow('grade_blocked')
  })

  it('재진입 후 재임베딩 순환', () => {
    const s = makeSyncer()
    s.upsert('d', 'h1', 1)
    s.markEmbedded('d')
    s.upsert('d', 'h2', 2)
    expect(s.get('d')?.status).toBe('PENDING')
    s.markEmbedded('d')
    expect(s.get('d')?.status).toBe('EMBEDDED')
  })

  it('delete 없는 문서 오류', () => {
    const s = makeSyncer()
    expect(() => s.delete('ghost')).toThrow('not_found')
  })

  it('getAuditLog', () => {
    const s = makeSyncer()
    s.upsert('d', 'h', 1)
    s.markEmbedded('d')
    s.upsert('d', 'h2', 2)
    s.delete('d')
    const log = s.getAuditLog()
    expect(log.some((e) => e.event === 'doc_created')).toBe(true)
    expect(log.some((e) => e.event === 'doc_changed')).toBe(true)
    expect(log.some((e) => e.event === 'doc_embedded')).toBe(true)
    expect(log.some((e) => e.event === 'doc_deleted')).toBe(true)
  })
})
