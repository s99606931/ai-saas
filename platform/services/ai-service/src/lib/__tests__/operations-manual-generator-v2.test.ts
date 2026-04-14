import { describe, it, expect, beforeEach } from 'vitest'
import { OperationsManualGeneratorV2 } from '../operations-manual-generator-v2'

describe('OperationsManualGeneratorV2', () => {
  let generator: OperationsManualGeneratorV2

  beforeEach(() => {
    generator = new OperationsManualGeneratorV2()
  })

  it('섹션 등록 후 조회 가능', () => {
    const section = generator.addSection('sec-1', '시스템 개요', '내용...', 'overview')
    expect(section.sectionId).toBe('sec-1')
    expect(section.category).toBe('overview')
  })

  it('섹션 내용 업데이트', () => {
    generator.addSection('sec-1', '시스템 개요', '이전 내용', 'overview')
    generator.updateSection('sec-1', '새 내용')
    const toc = generator.getTableOfContents()
    expect(toc.find((t) => t.sectionId === 'sec-1')).toBeDefined()
  })

  it('getTableOfContents: 모든 섹션 반환', () => {
    generator.addSection('sec-1', '개요', '내용', 'overview')
    generator.addSection('sec-2', '운영절차', '내용', 'operations')
    const toc = generator.getTableOfContents()
    expect(toc).toHaveLength(2)
    expect(toc[0]).toHaveProperty('sectionId')
    expect(toc[0]).toHaveProperty('title')
    expect(toc[0]).toHaveProperty('category')
  })

  it('getSectionsByCategory: 카테고리 필터링', () => {
    generator.addSection('sec-1', '개요', '내용', 'overview')
    generator.addSection('sec-2', '운영절차', '내용', 'operations')
    generator.addSection('sec-3', '모니터링', '내용', 'operations')
    const opsSections = generator.getSectionsByCategory('operations')
    expect(opsSections.map((s) => s.sectionId)).toContain('sec-2')
    expect(opsSections.map((s) => s.sectionId)).toContain('sec-3')
    expect(opsSections.map((s) => s.sectionId)).not.toContain('sec-1')
  })

  it('C등급 데이터 전송 차단', () => {
    generator.addSection('sec-1', '시스템 개요', '내용', 'overview')
    expect(() => generator.updateSection('sec-1', '새 내용', 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    generator.addSection('sec-1', '시스템 개요', '내용', 'overview')
    expect(() => generator.updateSection('sec-1', '새 내용', 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    generator.addSection('sec-1', '시스템 개요', '내용', 'overview')
    generator.updateSection('sec-1', '새 내용')
    const log = generator.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
