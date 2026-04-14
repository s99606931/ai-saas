import { describe, it, expect, beforeEach } from 'vitest'
import { MultimodalPublicSearchV3 } from '../multimodal-public-search-v3'

describe('MultimodalPublicSearchV3', () => {
  let svc: MultimodalPublicSearchV3

  beforeEach(() => {
    svc = new MultimodalPublicSearchV3()
    svc.indexDocument({
      docId: 'd1',
      title: '주민등록 발급 안내',
      text: '주민등록증 발급 절차 및 필요 서류',
      modalities: ['TEXT', 'PDF'],
      tags: ['민원', '신분증'],
    })
    svc.indexDocument({
      docId: 'd2',
      title: '여권 발급',
      text: '여권 발급 절차',
      modalities: ['TEXT', 'IMAGE'],
      tags: ['여권', '민원'],
    })
  })

  it('returns empty when no match', () => {
    const r = svc.search({ text: '존재하지않음', userId: 'u1' })
    expect(r).toHaveLength(0)
  })

  it('ranks title match higher than text match', () => {
    const r = svc.search({ text: '여권', userId: 'u1' })
    expect(r[0]?.docId).toBe('d2')
  })

  it('matches by tags', () => {
    const r = svc.search({ tags: ['신분증'], userId: 'u1' })
    expect(r.some((x) => x.docId === 'd1')).toBe(true)
  })

  it('tracks matched modalities', () => {
    const r = svc.search({ tags: ['민원'], modalities: ['PDF'], userId: 'u1' })
    const d1 = r.find((x) => x.docId === 'd1')
    expect(d1?.matchedModalities).toContain('PDF')
  })

  it('blocks C/S grade on index and search', () => {
    expect(() =>
      svc.indexDocument(
        { docId: 'x', title: 't', text: 't', modalities: ['TEXT'], tags: [] },
        'C',
      ),
    ).toThrow('BLOCKED')
    expect(() => svc.search({ userId: 'u' }, 'S')).toThrow('BLOCKED')
  })

  it('masks userId in audit log', () => {
    svc.search({ text: '여권', userId: 'user@example.com' })
    const entry = svc.getAuditLog().find((e) => e.action === 'SEARCH')
    expect(entry?.actor).not.toBe('user@example.com')
    expect(String(entry?.actor)).toHaveLength(16)
  })
})
