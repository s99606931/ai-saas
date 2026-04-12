/**
 * Tests — SVC-AI-ADV-R146 Bid Award Predictor
 */

import { describe, it, expect } from 'vitest'
import { BidAwardPredictor } from '../bid-award-predictor'

function makePredictor() {
  let t = 1_700_000_000_000
  return new BidAwardPredictor({
    now: () => {
      t += 1
      return t
    },
  })
}

describe('BidAwardPredictor', () => {
  it('기본 예측 결정론', () => {
    const p = makePredictor()
    p.submit({
      bidId: 'A',
      price: 8000,
      techScore: 90,
      priorWins: 5,
      experienceYears: 10,
    })
    const r1 = p.predict({ budget: 10_000 })
    const r2 = p.predict({ budget: 10_000 })
    expect(r1[0]!.probability).toBe(r2[0]!.probability)
    expect(r1[0]!.probability).toBeGreaterThan(0.5)
  })

  it('가격 페널티 반영', () => {
    const p = makePredictor()
    p.submit({
      bidId: 'cheap',
      price: 8000,
      techScore: 80,
      priorWins: 3,
      experienceYears: 5,
    })
    p.submit({
      bidId: 'expensive',
      price: 11_900,
      techScore: 80,
      priorWins: 3,
      experienceYears: 5,
    })
    const r = p.predict({ budget: 10_000 })
    const cheap = r.find((x) => x.bidId === 'cheap')!
    const expensive = r.find((x) => x.bidId === 'expensive')!
    expect(cheap.probability).toBeGreaterThan(expensive.probability)
    expect(cheap.rank).toBe(1)
  })

  it('랭킹 순서', () => {
    const p = makePredictor()
    p.submit({
      bidId: 'A',
      price: 8000,
      techScore: 100,
      priorWins: 10,
      experienceYears: 20,
    })
    p.submit({
      bidId: 'B',
      price: 10_000,
      techScore: 50,
      priorWins: 0,
      experienceYears: 1,
    })
    const r = p.predict({ budget: 10_000 })
    expect(r[0]!.bidId).toBe('A')
    expect(r[1]!.bidId).toBe('B')
    expect(r[0]!.rank).toBe(1)
  })

  it('예산 초과 가격 확률 낮음', () => {
    const p = makePredictor()
    p.submit({
      bidId: 'over',
      price: 13_000,
      techScore: 50,
      priorWins: 0,
      experienceYears: 0,
    })
    const r = p.predict({ budget: 10_000 })
    expect(r[0]!.probability).toBeLessThan(0.5)
  })

  it('가중치 커스터마이징', () => {
    const p = makePredictor()
    p.submit({
      bidId: 'techHeavy',
      price: 9000,
      techScore: 100,
      priorWins: 0,
      experienceYears: 0,
    })
    const r1 = p.predict({
      budget: 10_000,
      weights: { tech: 0.9, price: 0.1, wins: 0, experience: 0 },
    })
    const r2 = p.predict({
      budget: 10_000,
      weights: { tech: 0.1, price: 0.1, wins: 0.4, experience: 0.4 },
    })
    expect(r1[0]!.probability).toBeGreaterThan(r2[0]!.probability)
  })

  it('중복 bidId 거부', () => {
    const p = makePredictor()
    p.submit({
      bidId: 'A',
      price: 1,
      techScore: 1,
      priorWins: 0,
      experienceYears: 0,
    })
    expect(() =>
      p.submit({
        bidId: 'A',
        price: 2,
        techScore: 1,
        priorWins: 0,
        experienceYears: 0,
      }),
    ).toThrow('duplicate_bid')
  })

  it('음수 가격 거부', () => {
    const p = makePredictor()
    expect(() =>
      p.submit({
        bidId: 'x',
        price: -1,
        techScore: 50,
        priorWins: 0,
        experienceYears: 0,
      }),
    ).toThrow('invalid_price')
  })

  it('기술점수 범위 검증', () => {
    const p = makePredictor()
    expect(() =>
      p.submit({
        bidId: 'x',
        price: 1,
        techScore: 120,
        priorWins: 0,
        experienceYears: 0,
      }),
    ).toThrow('invalid_tech')
  })

  it('feature 음수 거부', () => {
    const p = makePredictor()
    expect(() =>
      p.submit({
        bidId: 'x',
        price: 1,
        techScore: 50,
        priorWins: -1,
        experienceYears: 0,
      }),
    ).toThrow('invalid_feature')
  })

  it('예산 0 거부', () => {
    const p = makePredictor()
    expect(() => p.predict({ budget: 0 })).toThrow('invalid_budget')
    expect(() => p.predict({ budget: -100 })).toThrow('invalid_budget')
  })

  it('C/S등급 차단', () => {
    const p = makePredictor()
    expect(() =>
      p.submit(
        {
          bidId: 'x',
          price: 1,
          techScore: 1,
          priorWins: 0,
          experienceYears: 0,
        },
        'C',
      ),
    ).toThrow('grade_blocked')
  })

  it('getAuditLog', () => {
    const p = makePredictor()
    p.submit({
      bidId: 'A',
      price: 8000,
      techScore: 90,
      priorWins: 5,
      experienceYears: 10,
    })
    p.predict({ budget: 10_000 })
    const log = p.getAuditLog()
    expect(log.some((e) => e.event === 'bid_submitted')).toBe(true)
    expect(log.some((e) => e.event === 'predicted')).toBe(true)
  })

  it('빈 bidId 거부', () => {
    const p = makePredictor()
    expect(() =>
      p.submit({
        bidId: '',
        price: 1,
        techScore: 1,
        priorWins: 0,
        experienceYears: 0,
      }),
    ).toThrow('invalid_bid')
  })
})
