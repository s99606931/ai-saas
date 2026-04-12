/**
 * Maintenance Window Optimizer — SVC-AI-ADV-R108
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R108.design.md
 * Plan SC: FR-R108.1 ~ FR-R108.5
 *
 * 트래픽 프로파일 기반 최적 점검 윈도우 제안.
 */

export interface HourlyTraffic {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  hour: number
  rps: number
}

export interface MaintenanceRequest {
  durationHours: number
  deadlineIso: string
  preferWeekend?: boolean
}

export interface ScheduleProposal {
  startIso: string
  endIso: string
  expectedAffectedUsers: number
  score: number
  reasoning: string
}

export class MaintenanceWindowOptimizer {
  /**
   * FR-R108.1~5: 최적 윈도우 제안.
   */
  propose(
    traffic: HourlyTraffic[],
    req: MaintenanceRequest,
    now: Date,
  ): ScheduleProposal {
    const deadline = new Date(req.deadlineIso)
    if (deadline.getTime() <= now.getTime()) {
      throw new Error('deadline must be in the future')
    }

    // 트래픽을 (dow, hour) → rps 맵으로
    const map = new Map<string, number>()
    for (const t of traffic) {
      map.set(`${t.dayOfWeek}-${t.hour}`, t.rps)
    }

    let best: ScheduleProposal | null = null
    const cursor = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours() + 1,
      ),
    )

    const maxIter = 24 * 14 // 최대 2주
    let iter = 0
    while (cursor.getTime() + req.durationHours * 3600_000 <= deadline.getTime()) {
      if (++iter > maxIter) break
      const proposal = this.evaluate(cursor, req, map)
      if (!best || proposal.score < best.score) {
        best = proposal
      }
      cursor.setUTCHours(cursor.getUTCHours() + 1)
    }

    if (!best) {
      throw new Error('no feasible window before deadline')
    }
    return best
  }

  private evaluate(
    start: Date,
    req: MaintenanceRequest,
    trafficMap: Map<string, number>,
  ): ScheduleProposal {
    let total = 0
    let isWeekendHours = 0
    for (let h = 0; h < req.durationHours; h++) {
      const slot = new Date(start.getTime() + h * 3600_000)
      const dow = slot.getUTCDay()
      const hour = slot.getUTCHours()
      const rps = trafficMap.get(`${dow}-${hour}`) ?? 0
      total += rps
      if (dow === 0 || dow === 6) isWeekendHours++
    }

    const weekendBonus = req.preferWeekend
      ? 1 - (0.1 * isWeekendHours) / req.durationHours
      : 1
    const score = total * weekendBonus

    const end = new Date(start.getTime() + req.durationHours * 3600_000)

    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      expectedAffectedUsers: Math.round(total),
      score: Math.round(score * 100) / 100,
      reasoning: `합계 rps=${total}, 주말시간=${isWeekendHours}h`,
    }
  }
}
