/**
 * Unit tests for AI Onboarding Engine — SVC-AI-ADV-R98
 */

import { describe, it, expect } from 'vitest'
import {
  AiOnboardingEngine,
  type OnboardingStep,
} from '../ai-onboarding-engine'

const steps: OnboardingStep[] = [
  { id: 's1', title: '프로필 작성', description: '', order: 1, required: true },
  { id: 's2', title: '약관 동의', description: '', order: 2, required: true },
  { id: 's3', title: '알림 설정', description: '', order: 3, required: false },
]

describe('SVC-AI-ADV-R98 AiOnboardingEngine', () => {
  it('[FR-R98.1] registers template and starts onboarding', () => {
    const e = new AiOnboardingEngine({ now: () => 1000 })
    e.registerTemplate('citizen', steps)
    const prog = e.startOnboarding('u1', 'citizen')
    expect(prog.completedSteps).toEqual([])
    expect(prog.startedAt).toBeDefined()
  })

  it('[FR-R98.3] completes step', () => {
    const e = new AiOnboardingEngine({ now: () => 1000 })
    e.registerTemplate('citizen', steps)
    e.startOnboarding('u1', 'citizen')
    const result = e.completeStep('u1', 's1')
    expect(result.completedSteps).toContain('s1')
  })

  it('[FR-R98.4] getNextStep returns required first', () => {
    const e = new AiOnboardingEngine({ now: () => 1000 })
    e.registerTemplate('citizen', steps)
    e.startOnboarding('u1', 'citizen')
    const next = e.getNextStep('u1')
    expect(next?.id).toBe('s1') // required, order=1
  })

  it('[FR-R98.4] getNextStep returns null when all complete', () => {
    const e = new AiOnboardingEngine({ now: () => 1000 })
    e.registerTemplate('citizen', steps)
    e.startOnboarding('u1', 'citizen')
    e.completeStep('u1', 's1')
    e.completeStep('u1', 's2')
    e.completeStep('u1', 's3')
    expect(e.getNextStep('u1')).toBeNull()
  })

  it('[FR-R98.5] progressReport computes ratio', () => {
    const e = new AiOnboardingEngine({ now: () => 1000 })
    e.registerTemplate('citizen', steps)
    e.startOnboarding('u1', 'citizen')
    e.completeStep('u1', 's1')
    const report = e.progressReport('u1', new Date(10_000))
    expect(report.completedCount).toBe(1)
    expect(report.completionRatio).toBeCloseTo(1 / 3, 5)
    expect(report.requiredRemaining).toBe(1)
    expect(report.durationMs).toBe(9000)
  })

  it('[FR-R98.2] throws on unknown role', () => {
    const e = new AiOnboardingEngine()
    expect(() => e.startOnboarding('u1', 'unknown')).toThrow(/template/)
  })

  it('[FR-R98.3] throws on unknown step', () => {
    const e = new AiOnboardingEngine({ now: () => 1000 })
    e.registerTemplate('citizen', steps)
    e.startOnboarding('u1', 'citizen')
    expect(() => e.completeStep('u1', 'bogus')).toThrow(/step/)
  })
})
