// Design Ref: §클래스 설계 — CloudNativeAppOptimizerV2
// Plan SC: SVC-AI-ADV-R548

type Recommendation = 'scale-up' | 'scale-down' | 'optimal'

interface CloudApp {
  appId: string
  name: string
  framework: string
  replicaCount: number
}

interface AuditEntry { timestamp: string; action: string; appId: string; details?: Record<string, unknown> }

export class CloudNativeAppOptimizerV2 {
  private apps = new Map<string, CloudApp>()
  private usages = new Map<string, { cpuPercent: number; memPercent: number }>()
  private auditLog: AuditEntry[] = []

  registerApp(appId: string, name: string, framework: string, replicaCount: number): CloudApp {
    const app: CloudApp = { appId, name, framework, replicaCount }
    this.apps.set(appId, app)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_APP', appId, details: { name, framework, replicaCount } })
    return app
  }

  recordUsage(appId: string, cpuPercent: number, memPercent: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.apps.has(appId)) throw new Error(`앱을 찾을 수 없습니다: ${appId}`)
    this.usages.set(appId, { cpuPercent, memPercent })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_USAGE', appId, details: { cpuPercent, memPercent } })
  }

  getOptimizationRecommendation(appId: string): Recommendation {
    const usage = this.usages.get(appId)
    if (!usage) return 'optimal'
    if (usage.cpuPercent > 70 || usage.memPercent > 70) return 'scale-up'
    if (usage.cpuPercent < 30 && usage.memPercent < 30) return 'scale-down'
    return 'optimal'
  }

  getOverProvisionedApps(): CloudApp[] {
    return Array.from(this.apps.values()).filter(app => this.getOptimizationRecommendation(app.appId) === 'scale-down')
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
