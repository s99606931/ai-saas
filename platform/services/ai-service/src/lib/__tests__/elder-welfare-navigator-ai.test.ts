// Plan SC: SVC-AI-ADV-R635
import { describe, it, expect, beforeEach } from 'vitest'
import { ElderWelfareNavigatorAI } from '../elder-welfare-navigator-ai'

describe('ElderWelfareNavigatorAI', () => {
  let ai: ElderWelfareNavigatorAI

  beforeEach(() => {
    ai = new ElderWelfareNavigatorAI()
    ai.registerProgram({
      programId: 'p1',
      name: '무료 급식',
      minAge: 65,
      maxAge: 100,
      needs: ['meal', 'healthcare'],
      incomeLimit: 1500000,
      slots: 10,
    })
  })

  it('registerProgram — 감사 로그 기록', () => {
    expect(ai.getAuditLog()[0]!.action).toBe('program.register')
  })

  it('findMatches — 자격 충족 시 매칭', () => {
    const r = ai.findMatches({
      profileId: 'e1',
      age: 70,
      monthlyIncome: 1000000,
      needs: ['meal'],
    })
    expect(r.matches).toHaveLength(1)
    expect(r.matches[0]!.score).toBe(100)
  })

  it('findMatches — 연령 미달 시 매칭 없음', () => {
    const r = ai.findMatches({
      profileId: 'e2',
      age: 60,
      monthlyIncome: 1000000,
      needs: ['meal'],
    })
    expect(r.matches).toHaveLength(0)
  })

  it('findMatches — 소득 초과 시 매칭 없음', () => {
    const r = ai.findMatches({
      profileId: 'e3',
      age: 70,
      monthlyIncome: 2000000,
      needs: ['meal'],
    })
    expect(r.matches).toHaveLength(0)
  })

  it('reserveSlot — 슬롯 감소', () => {
    expect(ai.reserveSlot('p1')).toBe(true)
    expect(ai.reserveSlot('unknown')).toBe(false)
  })

  it('findMatches — S등급 차단', () => {
    expect(() =>
      ai.findMatches({ profileId: 'e4', age: 70, monthlyIncome: 1000000, needs: ['meal'] }, 'S'),
    ).toThrow('BLOCKED')
  })
})
