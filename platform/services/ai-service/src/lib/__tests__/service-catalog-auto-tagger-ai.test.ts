// Plan SC: SVC-AI-ADV-R436-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceCatalogAutoTaggerAI, type CatalogEntry } from '../service-catalog-auto-tagger-ai'

describe('ServiceCatalogAutoTaggerAI', () => {
  let tagger: ServiceCatalogAutoTaggerAI

  beforeEach(() => {
    tagger = new ServiceCatalogAutoTaggerAI()
  })

  const baseEntry: CatalogEntry = {
    entryId: 'E1',
    name: '사용자 인증 서비스',
    description: '인증 및 로그인 처리, 세션 관리, 권한 검사',
    owner: 'security-team',
    existingTags: [],
  }

  it('인증 관련 설명 → auth 도메인 태그 생성', () => {
    const result = tagger.tag(baseEntry)
    const authTag = result.newTags.find((t) => t.tag === 'auth')
    expect(authTag).toBeDefined()
    expect(authTag?.category).toBe('DOMAIN')
  })

  it('기존 태그는 중복 추가 안 됨', () => {
    const result = tagger.tag({ ...baseEntry, existingTags: ['auth'] })
    const authTags = result.newTags.filter((t) => t.tag === 'auth')
    expect(authTags).toHaveLength(0)
  })

  it('allTags: 기존 + 신규 합산', () => {
    const result = tagger.tag({ ...baseEntry, existingTags: ['existing-tag'] })
    expect(result.allTags).toContain('existing-tag')
    expect(result.allTags.length).toBeGreaterThan(1)
  })

  it('소유자 태그 자동 생성', () => {
    const result = tagger.tag(baseEntry)
    const ownerTag = result.newTags.find((t) => t.tag.startsWith('owner:'))
    expect(ownerTag).toBeDefined()
    expect(ownerTag?.tag).toBe('owner:security-team')
    expect(ownerTag?.category).toBe('LIFECYCLE')
  })

  it('CSAP/N2SF 키워드 → 컴플라이언스 태그', () => {
    const result = tagger.tag({
      ...baseEntry,
      entryId: 'E2',
      name: 'CSAP 감사 로그 서비스',
      description: '개인정보 PII 마스킹 및 감사 로그 기록',
    })
    const complianceTags = result.newTags.filter((t) => t.category === 'COMPLIANCE')
    expect(complianceTags.length).toBeGreaterThan(0)
  })

  it('tagsAdded 정확히 계산', () => {
    const result = tagger.tag(baseEntry)
    expect(result.tagsAdded).toBe(result.newTags.length)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    tagger.tag(baseEntry)
    const log1 = tagger.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', entryId: 'X', detail: {} })
    const log2 = tagger.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
