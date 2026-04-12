// Design Ref: §R256 — AI기반 컨테이너 리소스 최적화
// Plan SC: SVC-AI-ADV-R256-SC01
// CSAP D-06: 감사 로그, D-12: 입력 검증

export type ResourceAction = 'INCREASE_CPU' | 'DECREASE_CPU' | 'INCREASE_MEMORY' | 'DECREASE_MEMORY' | 'NO_CHANGE'

export interface ContainerSpec {
  containerId: string
  name: string
  namespace: string
  cpuLimitMilliCores: number
  memoryLimitMb: number
  minCpuMilliCores: number
  minMemoryMb: number
}

export interface ResourceSnapshot {
  containerId: string
  timestamp: number
  cpuUsageMilliCores: number
  memoryUsageMb: number
  oomKillCount: number
}

export interface ResourceOptimization {
  containerId: string
  cpuAction: ResourceAction
  memoryAction: ResourceAction
  recommendedCpuMilliCores: number
  recommendedMemoryMb: number
  cpuUtilization: number
  memoryUtilization: number
  oomRisk: boolean
  reason: string
}

interface AuditEntry {
  timestamp: string
  action: string
  containerId: string
  detail: Record<string, unknown>
}

const HIGH_CPU_UTIL = 0.85
const LOW_CPU_UTIL = 0.2
const HIGH_MEM_UTIL = 0.85
const LOW_MEM_UTIL = 0.2

export class ContainerResourceOptimizerAi {
  private containers = new Map<string, ContainerSpec>()
  private snapshots = new Map<string, ResourceSnapshot[]>()
  private auditLog: AuditEntry[] = []

  registerContainer(spec: ContainerSpec): void {
    this.containers.set(spec.containerId, spec)
    this.snapshots.set(spec.containerId, [])
    this.appendAudit('container.register', spec.containerId, { name: spec.name, namespace: spec.namespace })
  }

  recordSnapshot(snapshot: ResourceSnapshot): void {
    if (!this.containers.has(snapshot.containerId)) throw new Error(`Unknown container: ${snapshot.containerId}`)
    const list = this.snapshots.get(snapshot.containerId) ?? []
    list.push(snapshot)
    this.snapshots.set(snapshot.containerId, list)
  }

  optimize(containerId: string): ResourceOptimization {
    const spec = this.containers.get(containerId)
    if (!spec) throw new Error(`Unknown container: ${containerId}`)

    const history = this.snapshots.get(containerId) ?? []
    if (history.length === 0) {
      return {
        containerId,
        cpuAction: 'NO_CHANGE',
        memoryAction: 'NO_CHANGE',
        recommendedCpuMilliCores: spec.cpuLimitMilliCores,
        recommendedMemoryMb: spec.memoryLimitMb,
        cpuUtilization: 0,
        memoryUtilization: 0,
        oomRisk: false,
        reason: '스냅샷 데이터 없음',
      }
    }

    const recent = history.slice(-5)
    const avgCpu = recent.reduce((s, r) => s + r.cpuUsageMilliCores, 0) / recent.length
    const avgMem = recent.reduce((s, r) => s + r.memoryUsageMb, 0) / recent.length
    const totalOom = recent.reduce((s, r) => s + r.oomKillCount, 0)

    const cpuUtil = avgCpu / spec.cpuLimitMilliCores
    const memUtil = avgMem / spec.memoryLimitMb
    const oomRisk = totalOom > 0 || memUtil > 0.95

    let cpuAction: ResourceAction = 'NO_CHANGE'
    let memoryAction: ResourceAction = 'NO_CHANGE'
    let recommendedCpu = spec.cpuLimitMilliCores
    let recommendedMem = spec.memoryLimitMb
    const reasons: string[] = []

    if (cpuUtil > HIGH_CPU_UTIL) {
      cpuAction = 'INCREASE_CPU'
      recommendedCpu = Math.round(spec.cpuLimitMilliCores * 1.5)
      reasons.push(`CPU 사용률 ${Math.round(cpuUtil * 100)}% — 증가 권고`)
    } else if (cpuUtil < LOW_CPU_UTIL && spec.cpuLimitMilliCores > spec.minCpuMilliCores) {
      cpuAction = 'DECREASE_CPU'
      recommendedCpu = Math.max(spec.minCpuMilliCores, Math.round(avgCpu * 1.5))
      reasons.push(`CPU 사용률 ${Math.round(cpuUtil * 100)}% — 축소 권고`)
    }

    if (oomRisk || memUtil > HIGH_MEM_UTIL) {
      memoryAction = 'INCREASE_MEMORY'
      recommendedMem = spec.memoryLimitMb * 2
      reasons.push(oomRisk ? 'OOM Kill 발생 — 메모리 증가 필수' : `메모리 사용률 ${Math.round(memUtil * 100)}% — 증가 권고`)
    } else if (memUtil < LOW_MEM_UTIL && spec.memoryLimitMb > spec.minMemoryMb) {
      memoryAction = 'DECREASE_MEMORY'
      recommendedMem = Math.max(spec.minMemoryMb, Math.round(avgMem * 1.5))
      reasons.push(`메모리 사용률 ${Math.round(memUtil * 100)}% — 축소 권고`)
    }

    const reason = reasons.length > 0 ? reasons.join('; ') : '리소스 상태 정상'

    this.appendAudit('container.optimize', containerId, { cpuAction, memoryAction, cpuUtil: Math.round(cpuUtil * 100) / 100, oomRisk })

    return {
      containerId,
      cpuAction,
      memoryAction,
      recommendedCpuMilliCores: recommendedCpu,
      recommendedMemoryMb: recommendedMem,
      cpuUtilization: Math.round(cpuUtil * 100) / 100,
      memoryUtilization: Math.round(memUtil * 100) / 100,
      oomRisk,
      reason,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, containerId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, containerId, detail })
  }
}
