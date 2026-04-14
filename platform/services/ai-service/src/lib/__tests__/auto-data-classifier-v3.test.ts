import { describe, it, expect, beforeEach } from 'vitest'
import { AutoDataClassifierV3 } from '../auto-data-classifier-v3'

describe('AutoDataClassifierV3', () => {
  let classifier: AutoDataClassifierV3

  beforeEach(() => {
    classifier = new AutoDataClassifierV3()
  })

  it('항목 등록 후 조회 가능', () => {
    const item = classifier.registerItem('item-1', '공개데이터', ['public', 'report'])
    expect(item.itemId).toBe('item-1')
  })

  it('C등급 분류: 개인정보 키워드 포함', () => {
    classifier.registerItem('item-1', '민감데이터', ['주민번호', 'report'])
    const grade = classifier.classifyItem('item-1')
    expect(grade).toBe('C')
  })

  it('S등급 분류: 기밀 키워드 포함', () => {
    classifier.registerItem('item-1', '내부데이터', ['internal', 'report'])
    const grade = classifier.classifyItem('item-1')
    expect(grade).toBe('S')
  })

  it('O등급 분류: 일반 키워드', () => {
    classifier.registerItem('item-1', '공개데이터', ['public', 'report'])
    const grade = classifier.classifyItem('item-1')
    expect(grade).toBe('O')
  })

  it('C 규칙이 S보다 우선', () => {
    classifier.registerItem('item-1', '복합데이터', ['주민번호', 'confidential'])
    const grade = classifier.classifyItem('item-1')
    expect(grade).toBe('C')
  })

  it('getItemsByGrade: 등급별 필터링', () => {
    classifier.registerItem('item-1', '공개', ['public'])
    classifier.registerItem('item-2', '기밀', ['internal'])
    classifier.classifyItem('item-1')
    classifier.classifyItem('item-2')
    const sItems = classifier.getItemsByGrade('S')
    expect(sItems.map((i) => i.itemId)).toContain('item-2')
    expect(sItems.map((i) => i.itemId)).not.toContain('item-1')
  })

  it('C등급 데이터 전송 차단', () => {
    classifier.registerItem('item-1', '공개데이터', ['public'])
    expect(() => classifier.classifyItem('item-1', 'C')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    classifier.registerItem('item-1', '공개데이터', ['public'])
    classifier.classifyItem('item-1')
    const log = classifier.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
