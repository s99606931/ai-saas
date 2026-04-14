import { describe, it, expect, beforeEach } from 'vitest'
import { PerformanceManagementAutomatorV2 } from '../performance-management-automator-v2'

describe('PerformanceManagementAutomatorV2', () => {
  let automator: PerformanceManagementAutomatorV2

  beforeEach(() => {
    automator = new PerformanceManagementAutomatorV2()
  })

  it('should register a goal', () => {
    automator.registerGoal('g1', 'Sales Target', 80, 'Q1')
    expect(automator.isAchieved('g1')).toBe(false)
  })

  it('should record evaluation and compute average', () => {
    automator.registerGoal('g1', 'Target', 70, 'Q1')
    automator.recordEvaluation('g1', 'eval-1', 75)
    automator.recordEvaluation('g1', 'eval-2', 85)
    expect(automator.isAchieved('g1')).toBe(true)
  })

  it('should not achieve goal when avg below target', () => {
    automator.registerGoal('g1', 'Target', 90, 'Q1')
    automator.recordEvaluation('g1', 'eval-1', 60)
    automator.recordEvaluation('g1', 'eval-2', 70)
    expect(automator.isAchieved('g1')).toBe(false)
  })

  it('should mask evaluatorId with SHA-256', () => {
    automator.registerGoal('g1', 'T', 50, 'Q1')
    automator.recordEvaluation('g1', 'user-123', 80)
    const log = automator.getAuditLog()
    const evalEntry = log.find((e: { action: string }) => e.action === 'RECORD_EVALUATION')
    expect(evalEntry).toBeDefined()
    expect(evalEntry?.maskedEvaluatorId).not.toBe('user-123')
    expect(evalEntry?.maskedEvaluatorId).toHaveLength(16)
  })

  it('should return unachieved goals', () => {
    automator.registerGoal('g1', 'Good', 80, 'Q1')
    automator.registerGoal('g2', 'Bad', 90, 'Q1')
    automator.recordEvaluation('g1', 'e1', 85)
    automator.recordEvaluation('g2', 'e1', 60)
    const unachieved = automator.getUnachievedGoals()
    expect(unachieved.map((g: { goalId: string }) => g.goalId)).toContain('g2')
    expect(unachieved.map((g: { goalId: string }) => g.goalId)).not.toContain('g1')
  })

  it('should block C grade data', () => {
    automator.registerGoal('g1', 'T', 50, 'Q1')
    expect(() => automator.recordEvaluation('g1', 'e1', 80, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    automator.registerGoal('g1', 'T', 50, 'Q1')
    expect(() => automator.recordEvaluation('g1', 'e1', 80, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    automator.registerGoal('g1', 'T', 50, 'Q1')
    automator.recordEvaluation('g1', 'e1', 60)
    expect(automator.getAuditLog().length).toBeGreaterThan(0)
  })
})
