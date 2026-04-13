// Design Ref: §R353 — AI기반 보안 취약점 자동 격리
// Plan SC: SC-R353

export interface VulnerabilityAlert {
  alertId: string
  serviceId: string
  cveId: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  affectedComponent: string
  exploitDetected: boolean
  affectedPodCount: number
}

export type IsolationAction = 'FULL_ISOLATION' | 'PARTIAL_ISOLATION' | 'MONITOR_ONLY' | 'NO_ACTION'

export interface IsolationDecision {
  alertId: string
  serviceId: string
  action: IsolationAction
  isolatedPods: number
  networkPolicyApplied: boolean
  rollbackRequired: boolean
  reason: string
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class SecurityVulnAutoIsolator {
  private auditLog: AuditEntry[] = []

  isolate(alert: VulnerabilityAlert): IsolationDecision {
    let action: IsolationAction
    let isolatedPods = 0
    let networkPolicyApplied = false
    let rollbackRequired = false
    let reason: string

    if (alert.exploitDetected || alert.severity === 'CRITICAL') {
      action = 'FULL_ISOLATION'
      isolatedPods = alert.affectedPodCount
      networkPolicyApplied = true
      rollbackRequired = true
      reason = alert.exploitDetected
        ? '활성 익스플로잇 탐지 — 즉시 전체 격리'
        : 'CRITICAL 취약점 — 전체 격리 및 패치 필요'
    } else if (alert.severity === 'HIGH') {
      action = 'PARTIAL_ISOLATION'
      isolatedPods = Math.ceil(alert.affectedPodCount / 2)
      networkPolicyApplied = true
      rollbackRequired = false
      reason = 'HIGH 취약점 — 부분 격리 후 패치 적용'
    } else if (alert.severity === 'MEDIUM') {
      action = 'MONITOR_ONLY'
      isolatedPods = 0
      networkPolicyApplied = false
      rollbackRequired = false
      reason = 'MEDIUM 취약점 — 모니터링 강화 및 계획 패치'
    } else {
      action = 'NO_ACTION'
      isolatedPods = 0
      networkPolicyApplied = false
      rollbackRequired = false
      reason = 'LOW 취약점 — 정기 패치 사이클에 포함'
    }

    this.auditLog.push({ action: 'vuln.isolate', timestamp: new Date().toISOString(), detail: `${alert.alertId}:${action}` })
    return { alertId: alert.alertId, serviceId: alert.serviceId, action, isolatedPods, networkPolicyApplied, rollbackRequired, reason }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
