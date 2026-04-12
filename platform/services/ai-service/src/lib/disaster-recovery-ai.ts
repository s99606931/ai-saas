/**
 * 재해 복구 자동화 AI — SVC-AI-ADV-R160
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R160/SVC-AI-ADV-R160.design.md
 * Plan SC: FR-R160.1 ~ FR-R160.6
 *
 * RTO/RPO 기반 복구 계획 자동 생성 + 의존성 기반 실행 순서 결정.
 * CSAP D-09, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface ServiceNode {
  id: string
  rtoMinutes: number
  rpoMinutes: number
  dependencies: string[]
  priority: number
  recoveryTimeMinutes: number
}

export interface DisasterScenario {
  id: string
  affectedServices: string[]
  severity: 'partial' | 'full'
}

export interface RecoveryStep {
  order: number
  serviceId: string
  estimatedMinutes: number
  cumulativeMinutes: number
  rtoMet: boolean
}

export interface RecoveryPlan {
  scenarioId: string
  steps: RecoveryStep[]
  totalMinutes: number
  allRtoMet: boolean
  allRpoMet: boolean
  warnings: string[]
}

export interface DRAuditEntry {
  action: 'serviceRegistered' | 'planGenerated'
  timestamp: number
  details: Record<string, unknown>
}

export class DisasterRecoveryAI {
  private readonly services = new Map<string, ServiceNode>()
  private readonly auditLog: DRAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 재해복구 AI 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R160.1 */
  registerService(service: ServiceNode): void {
    if (!service.id.trim()) throw new Error('service id must not be empty')
    if (service.rtoMinutes <= 0) throw new Error('rtoMinutes must be > 0')
    if (service.recoveryTimeMinutes <= 0) throw new Error('recoveryTimeMinutes must be > 0')
    this.services.set(service.id, { ...service })
    this.audit('serviceRegistered', { id: service.id, rto: service.rtoMinutes })
  }

  /** FR-R160.3 ~ FR-R160.5 */
  generatePlan(scenario: DisasterScenario): RecoveryPlan {
    const affected = scenario.affectedServices.filter((id) => this.services.has(id))
    if (affected.length === 0) {
      return {
        scenarioId: scenario.id,
        steps: [],
        totalMinutes: 0,
        allRtoMet: true,
        allRpoMet: true,
        warnings: ['영향받는 서비스 없음'],
      }
    }

    const ordered = this.topologicalSort(affected)
    const steps: RecoveryStep[] = []
    const warnings: string[] = []
    let cumulative = 0

    ordered.forEach((serviceId, idx) => {
      const svc = this.services.get(serviceId)!
      cumulative += svc.recoveryTimeMinutes
      const rtoMet = cumulative <= svc.rtoMinutes
      if (!rtoMet) {
        warnings.push(`${serviceId}: RTO(${svc.rtoMinutes}분) 초과 예상 (${cumulative}분)`)
      }
      steps.push({
        order: idx + 1,
        serviceId,
        estimatedMinutes: svc.recoveryTimeMinutes,
        cumulativeMinutes: cumulative,
        rtoMet,
      })
    })

    const allRtoMet = steps.every((s) => s.rtoMet)
    const allRpoMet = scenario.severity === 'partial'

    const plan: RecoveryPlan = {
      scenarioId: scenario.id,
      steps,
      totalMinutes: cumulative,
      allRtoMet,
      allRpoMet,
      warnings,
    }

    this.audit('planGenerated', {
      scenarioId: scenario.id,
      steps: steps.length,
      totalMinutes: cumulative,
    })

    return plan
  }

  /** FR-R160.6 */
  getAuditLog(): readonly DRAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private topologicalSort(serviceIds: string[]): string[] {
    const idSet = new Set(serviceIds)
    const inDegree = new Map<string, number>()
    const graph = new Map<string, string[]>()

    for (const id of serviceIds) {
      inDegree.set(id, 0)
      graph.set(id, [])
    }

    for (const id of serviceIds) {
      const svc = this.services.get(id)!
      for (const dep of svc.dependencies) {
        if (idSet.has(dep)) {
          // dep must recover before id
          graph.get(dep)!.push(id)
          inDegree.set(id, (inDegree.get(id) ?? 0) + 1)
        }
      }
    }

    // Kahn's algorithm with priority sort
    const queue: string[] = serviceIds.filter((id) => (inDegree.get(id) ?? 0) === 0)
    queue.sort((a, b) => (this.services.get(b)!.priority - this.services.get(a)!.priority))

    const result: string[] = []
    while (queue.length > 0) {
      const node = queue.shift()!
      result.push(node)
      for (const neighbor of graph.get(node) ?? []) {
        const deg = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, deg)
        if (deg === 0) {
          queue.push(neighbor)
          queue.sort((a, b) => (this.services.get(b)!.priority - this.services.get(a)!.priority))
        }
      }
    }

    // Add remaining (cycle or unprocessed)
    for (const id of serviceIds) {
      if (!result.includes(id)) result.push(id)
    }

    return result
  }

  private audit(action: DRAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
