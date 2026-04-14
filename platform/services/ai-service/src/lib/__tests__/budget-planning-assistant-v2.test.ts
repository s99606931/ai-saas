import { describe, it, expect, beforeEach } from 'vitest'
import { BudgetPlanningAssistantV2 } from '../budget-planning-assistant-v2'

describe('BudgetPlanningAssistantV2', () => {
  let assistant: BudgetPlanningAssistantV2
  beforeEach(() => { assistant = new BudgetPlanningAssistantV2() })

  it('예산 항목 등록 후 조회 가능', () => {
    const item = assistant.registerItem('item-1', 'IT인프라', '인프라', 1000000)
    expect(item.itemId).toBe('item-1')
    expect(item.allocatedAmount).toBe(1000000)
  })

  it('지출 없으면 집행률 0', () => {
    assistant.registerItem('item-1', 'IT인프라', '인프라', 1000000)
    expect(assistant.getExecutionRate('item-1')).toBe(0)
  })

  it('집행률 계산: spentAmount/allocated*100', () => {
    assistant.registerItem('item-1', 'IT인프라', '인프라', 1000000)
    assistant.recordSpending('item-1', 500000)
    expect(assistant.getExecutionRate('item-1')).toBe(50)
  })

  it('누적 지출 합산', () => {
    assistant.registerItem('item-1', 'IT인프라', '인프라', 1000000)
    assistant.recordSpending('item-1', 300000)
    assistant.recordSpending('item-1', 200000)
    expect(assistant.getExecutionRate('item-1')).toBe(50)
  })

  it('getOverBudgetItems: 지출 > 배정액', () => {
    assistant.registerItem('item-1', 'IT인프라', '인프라', 1000000)
    assistant.registerItem('item-2', '교육훈련', '인력', 500000)
    assistant.recordSpending('item-1', 1200000)
    assistant.recordSpending('item-2', 300000)
    const over = assistant.getOverBudgetItems()
    expect(over.map(i => i.itemId)).toContain('item-1')
    expect(over.map(i => i.itemId)).not.toContain('item-2')
  })

  it('C등급 데이터 전송 차단', () => {
    assistant.registerItem('item-1', 'IT인프라', '인프라', 1000000)
    expect(() => assistant.recordSpending('item-1', 500000, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    assistant.registerItem('item-1', 'IT인프라', '인프라', 1000000)
    expect(() => assistant.recordSpending('item-1', 500000, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    assistant.registerItem('item-1', 'IT인프라', '인프라', 1000000)
    assistant.recordSpending('item-1', 500000)
    expect(assistant.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
