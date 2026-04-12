import { describe, it, expect, beforeEach } from 'vitest'
import { AIBudgetAllocator, type BudgetProject } from '../ai-budget-allocator'

describe('AIBudgetAllocator', () => {
  let allocator: AIBudgetAllocator

  const p1: BudgetProject = {
    projectId: 'PRJ-001',
    department: '복지국',
    requestedAmount: 50_000_000,
    priority: 90,
    urgency: 80,
    executionRate: 95,
    grade: 'O',
  }
  const p2: BudgetProject = {
    projectId: 'PRJ-002',
    department: '교육국',
    requestedAmount: 30_000_000,
    priority: 70,
    urgency: 60,
    executionRate: 85,
    grade: 'O',
  }
  const p3: BudgetProject = {
    projectId: 'PRJ-003',
    department: '교통국',
    requestedAmount: 40_000_000,
    priority: 50,
    urgency: 40,
    executionRate: 60,
    grade: 'O',
  }

  beforeEach(() => {
    allocator = new AIBudgetAllocator()
    allocator.setTotalBudget(100_000_000)
    allocator.registerProject(p1)
    allocator.registerProject(p2)
    allocator.registerProject(p3)
  })

  it('C등급 사업 차단', () => {
    expect(() =>
      allocator.registerProject({ ...p1, projectId: 'PRJ-X', grade: 'C' })
    ).toThrow('BLOCKED')
  })

  it('총예산 0 이하 차단', () => {
    const a = new AIBudgetAllocator()
    expect(() => a.setTotalBudget(0)).toThrow('totalBudget')
  })

  it('priority 범위 초과 차단', () => {
    expect(() =>
      allocator.registerProject({ ...p1, projectId: 'PRJ-Y', priority: 150 })
    ).toThrow('priority')
  })

  it('스코어 계산 — 가중치 반영', () => {
    const score = allocator.calculateScore('PRJ-001')
    // 90*0.4 + 80*0.3 + 95*0.3 = 36 + 24 + 28.5 = 88.5 → 89
    expect(score).toBeGreaterThanOrEqual(88)
    expect(score).toBeLessThanOrEqual(90)
  })

  it('배분 — 스코어 내림차순 + 예산 한도 준수', () => {
    const result = allocator.allocate()
    expect(result.totalAllocated).toBeLessThanOrEqual(100_000_000)
    // PRJ-001 (스코어 최고)이 첫 번째 우선
    expect(result.items[0]?.projectId).toBe('PRJ-001')
    expect(result.items[0]?.allocatedAmount).toBe(50_000_000)
  })

  it('배분 부족 → unfunded 기록', () => {
    const a = new AIBudgetAllocator()
    a.setTotalBudget(60_000_000)
    a.registerProject(p1)
    a.registerProject(p2)
    a.registerProject(p3)
    const result = a.allocate()
    // 50M (p1) + 10M (p2 일부) = 60M
    expect(result.totalAllocated).toBe(60_000_000)
    expect(result.unfunded.length).toBeGreaterThanOrEqual(1)
  })

  it('형평성 점수 — Gini + 레벨', () => {
    allocator.allocate()
    const metrics = allocator.getFairnessMetrics()
    expect(metrics.giniCoefficient).toBeGreaterThanOrEqual(0)
    expect(metrics.giniCoefficient).toBeLessThanOrEqual(1)
    expect(['FAIR', 'MODERATE', 'UNFAIR']).toContain(metrics.fairnessLevel)
  })

  it('형평성 보정 활성화 시 상위 부서 차감', () => {
    const a = new AIBudgetAllocator()
    a.setTotalBudget(500_000_000)
    a.registerProject({ ...p1, projectId: 'P1', department: 'X', requestedAmount: 300_000_000 })
    a.registerProject({ ...p2, projectId: 'P2', department: 'Y', requestedAmount: 50_000_000 })
    const before = a.allocate()
    const after = a.allocate({ enableFairnessCorrection: true })
    const beforeX = before.items.find((i) => i.department === 'X')?.allocatedAmount ?? 0
    const afterX = after.items.find((i) => i.department === 'X')?.allocatedAmount ?? 0
    expect(afterX).toBeLessThanOrEqual(beforeX)
  })

  it('allocate 전 metrics 호출 → 에러', () => {
    const a = new AIBudgetAllocator()
    a.setTotalBudget(100_000)
    expect(() => a.getFairnessMetrics()).toThrow('allocate')
  })

  it('감사 로그 — 부서명 마스킹', () => {
    allocator.allocate()
    const log = allocator.getAuditLog()
    const deptRegisters = log.filter((e) => e.action === 'project.register')
    expect(deptRegisters.length).toBeGreaterThan(0)
    for (const entry of deptRegisters) {
      expect(entry.departmentMasked).toContain('***')
      expect(entry.departmentMasked).not.toBe('복지국')
    }
  })
})
