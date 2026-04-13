// Design Ref: §R504 — 스마트 신호 최적화 AI
// Plan SC: SVC-AI-ADV-R504-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type SignalPhase = 'NORTH_SOUTH' | 'EAST_WEST'

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export interface IntersectionConfig {
  intersectionId: string
  minGreenSec: number
  maxGreenSec: number
  yellowSec: number
}

export interface TrafficSnapshot {
  intersectionId: string
  northSouthVehicles: number
  eastWestVehicles: number
  pedestriansWaiting: number
  timestamp: string
}

export interface OptimizedPlan {
  intersectionId: string
  phase: SignalPhase
  greenSec: number
  yellowSec: number
  cycleSec: number
  reason: string
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class SmartTrafficSignalOptimizer {
  private readonly intersections = new Map<string, IntersectionConfig>()
  private readonly auditLog: AuditEntry[] = []

  registerIntersection(cfg: IntersectionConfig): void {
    if (!cfg.intersectionId) throw new Error('intersectionId 필수')
    if (cfg.minGreenSec <= 0 || cfg.maxGreenSec <= cfg.minGreenSec) {
      throw new Error('minGreenSec/maxGreenSec 범위 오류')
    }
    if (cfg.yellowSec < 1) throw new Error('yellowSec은 1초 이상')
    if (this.intersections.has(cfg.intersectionId)) {
      throw new Error(`중복 intersectionId: ${cfg.intersectionId}`)
    }
    this.intersections.set(cfg.intersectionId, { ...cfg })
    this.appendAudit('intersection.register', { intersectionId: cfg.intersectionId })
  }

  optimize(snapshot: TrafficSnapshot, grade: DataGrade): OptimizedPlan {
    blockClassifiedData(grade)
    const cfg = this.intersections.get(snapshot.intersectionId)
    if (!cfg) throw new Error(`intersectionId 없음: ${snapshot.intersectionId}`)
    if (snapshot.northSouthVehicles < 0 || snapshot.eastWestVehicles < 0) {
      throw new Error('차량 수는 0 이상')
    }

    const ns = snapshot.northSouthVehicles
    const ew = snapshot.eastWestVehicles
    const total = ns + ew
    let phase: SignalPhase
    let dominantRatio: number
    let reason: string

    if (total === 0) {
      phase = 'NORTH_SOUTH'
      dominantRatio = 0.5
      reason = '교통 없음 — 기본 사이클'
    } else if (ns >= ew) {
      phase = 'NORTH_SOUTH'
      dominantRatio = ns / total
      reason = '남북 방향 우세'
    } else {
      phase = 'EAST_WEST'
      dominantRatio = ew / total
      reason = '동서 방향 우세'
    }

    // 보행자 대기가 많으면 짧은 녹색
    const pedFactor = snapshot.pedestriansWaiting > 10 ? 0.8 : 1
    const range = cfg.maxGreenSec - cfg.minGreenSec
    let greenSec = Math.round(cfg.minGreenSec + range * dominantRatio * pedFactor)
    greenSec = Math.max(cfg.minGreenSec, Math.min(cfg.maxGreenSec, greenSec))

    const cycleSec = greenSec + cfg.yellowSec

    this.appendAudit('signal.optimize', {
      intersectionId: snapshot.intersectionId,
      phase,
      greenSec,
    })

    return {
      intersectionId: snapshot.intersectionId,
      phase,
      greenSec,
      yellowSec: cfg.yellowSec,
      cycleSec,
      reason,
    }
  }

  listIntersections(): string[] {
    return [...this.intersections.keys()]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
