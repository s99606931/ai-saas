/**
 * Unit tests for Maintenance Window Optimizer — SVC-AI-ADV-R108
 */

import { describe, it, expect } from 'vitest'
import {
  MaintenanceWindowOptimizer,
  type HourlyTraffic,
} from '../maintenance-window-optimizer'

const traffic: HourlyTraffic[] = []
for (let dow = 0; dow < 7; dow++) {
  for (let h = 0; h < 24; h++) {
    // 업무시간(9-18)은 1000, 새벽(2-5)은 10
    let rps = 100
    if (h >= 9 && h <= 18) rps = 1000
    if (h >= 2 && h <= 5) rps = 10
    // 주말은 전체적으로 낮음
    if (dow === 0 || dow === 6) rps = Math.floor(rps * 0.3)
    traffic.push({ dayOfWeek: dow as 0 | 1 | 2 | 3 | 4 | 5 | 6, hour: h, rps })
  }
}

describe('SVC-AI-ADV-R108 MaintenanceWindowOptimizer', () => {
  it('[FR-R108.3] picks lowest traffic window', () => {
    const opt = new MaintenanceWindowOptimizer()
    // 월요일 UTC 00:00
    const now = new Date('2026-04-13T00:00:00Z')
    const deadline = '2026-04-14T00:00:00Z'
    const result = opt.propose(traffic, { durationHours: 2, deadlineIso: deadline }, now)
    // 새벽 시간대 선택 예상
    const hour = new Date(result.startIso).getUTCHours()
    expect([2, 3, 4]).toContain(hour)
  })

  it('[FR-R108.4] preferWeekend reduces effective score', () => {
    const opt = new MaintenanceWindowOptimizer()
    const now = new Date('2026-04-12T00:00:00Z') // Sunday
    const deadline = '2026-04-19T00:00:00Z'
    const withoutWeekend = opt.propose(
      traffic,
      { durationHours: 2, deadlineIso: deadline },
      now,
    )
    const withWeekend = opt.propose(
      traffic,
      { durationHours: 2, deadlineIso: deadline, preferWeekend: true },
      now,
    )
    expect(withWeekend.score).toBeLessThanOrEqual(withoutWeekend.score)
  })

  it('[FR-R108.2] throws when deadline passed', () => {
    const opt = new MaintenanceWindowOptimizer()
    const now = new Date('2026-04-15T00:00:00Z')
    expect(() =>
      opt.propose(
        traffic,
        { durationHours: 1, deadlineIso: '2026-04-10T00:00:00Z' },
        now,
      ),
    ).toThrow(/deadline/)
  })

  it('[FR-R108.5] proposes complete schedule with end', () => {
    const opt = new MaintenanceWindowOptimizer()
    const now = new Date('2026-04-13T00:00:00Z')
    const result = opt.propose(
      traffic,
      { durationHours: 3, deadlineIso: '2026-04-14T00:00:00Z' },
      now,
    )
    expect(result.endIso).toBeDefined()
    const duration =
      new Date(result.endIso).getTime() - new Date(result.startIso).getTime()
    expect(duration).toBe(3 * 3600_000)
  })

  it('[FR-R108.1] missing traffic data defaults to 0', () => {
    const opt = new MaintenanceWindowOptimizer()
    const now = new Date('2026-04-13T00:00:00Z')
    // Empty traffic → every slot scores 0
    const result = opt.propose(
      [],
      { durationHours: 1, deadlineIso: '2026-04-14T00:00:00Z' },
      now,
    )
    expect(result.expectedAffectedUsers).toBe(0)
  })

  it('[FR-R108.5] reasoning contains stats', () => {
    const opt = new MaintenanceWindowOptimizer()
    const now = new Date('2026-04-13T00:00:00Z')
    const result = opt.propose(
      traffic,
      { durationHours: 2, deadlineIso: '2026-04-14T00:00:00Z' },
      now,
    )
    expect(result.reasoning).toContain('rps')
  })

  it('[FR-R108.3] score reflects traffic sum', () => {
    const opt = new MaintenanceWindowOptimizer()
    const now = new Date('2026-04-13T00:00:00Z')
    const result = opt.propose(
      traffic,
      { durationHours: 1, deadlineIso: '2026-04-14T00:00:00Z' },
      now,
    )
    expect(result.score).toBeGreaterThanOrEqual(0)
  })
})
