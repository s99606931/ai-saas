// Design Ref: §R426 — Workforce Planning AI
// Plan SC: SC-R426

export interface DeptStatus {
  readonly deptId: string
  readonly workload: number
  readonly headcount: number
}

export type PlanAction = 'INCREASE' | 'DECREASE' | 'MAINTAIN'

export interface PlanAdvice {
  readonly deptId: string
  readonly loadPerHead: number
  readonly action: PlanAction
  readonly neededDelta: number
}

export interface WorkforcePlanReport {
  readonly totalDepts: number
  readonly advices: PlanAdvice[]
  readonly top3Increase: PlanAdvice[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class DigitalCapabilityAssessorV2 {
  private depts: DeptStatus[] = []
  private auditLog: AuditEntry[] = []

  registerDept(dept: DeptStatus): void {
    this.depts.push(dept)
    this.auditLog.push({ action: 'dept.register', timestamp: new Date().toISOString(), detail: dept.deptId })
  }

  plan(threshold = 100): WorkforcePlanReport {
    const advices: PlanAdvice[] = []

    for (const dept of this.depts) {
      const loadPerHead = dept.headcount > 0 ? Math.round((dept.workload / dept.headcount) * 10) / 10 : dept.workload
      const neededDelta = Math.round(dept.workload / threshold) - dept.headcount

      let action: PlanAction
      if (loadPerHead > threshold * 1.2) {
        action = 'INCREASE'
      } else if (loadPerHead < threshold * 0.6) {
        action = 'DECREASE'
      } else {
        action = 'MAINTAIN'
      }

      advices.push({ deptId: dept.deptId, loadPerHead, action, neededDelta })
    }

    const top3Increase = advices
      .filter((a) => a.action === 'INCREASE')
      .sort((a, b) => b.neededDelta - a.neededDelta)
      .slice(0, 3)

    this.auditLog.push({ action: 'workforce.plan', timestamp: new Date().toISOString(), detail: `depts=${this.depts.length}` })
    return { totalDepts: this.depts.length, advices, top3Increase }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
