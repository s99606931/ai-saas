// Design Ref: §클래스 설계 — DeploymentRollbackOptimizerV2
// Plan SC: SVC-AI-ADV-R554

type DeployStatus = 'running' | 'failed' | 'rolled-back'

interface Deployment {
  deployId: string
  serviceId: string
  version: string
  deployedAt: string
  status: DeployStatus
  errorRate: number
}

interface AuditEntry { timestamp: string; action: string; deployId: string; details?: Record<string, unknown> }

export class DeploymentRollbackOptimizerV2 {
  private deployments = new Map<string, Deployment>()
  private auditLog: AuditEntry[] = []

  registerDeployment(deployId: string, serviceId: string, version: string, deployedAt: string): Deployment {
    const deploy: Deployment = { deployId, serviceId, version, deployedAt, status: 'running', errorRate: 0 }
    this.deployments.set(deployId, deploy)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_DEPLOYMENT', deployId, details: { serviceId, version, deployedAt } })
    return deploy
  }

  updateStatus(deployId: string, status: DeployStatus, errorRate: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    const deploy = this.deployments.get(deployId)
    if (!deploy) throw new Error(`배포를 찾을 수 없습니다: ${deployId}`)
    deploy.status = status
    deploy.errorRate = errorRate
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'UPDATE_STATUS', deployId, details: { status, errorRate } })
  }

  needsRollback(deployId: string): boolean {
    const deploy = this.deployments.get(deployId)
    if (!deploy) throw new Error(`배포를 찾을 수 없습니다: ${deployId}`)
    return deploy.errorRate > 5
  }

  getRollbackCandidates(): Deployment[] {
    return Array.from(this.deployments.values()).filter(d => this.needsRollback(d.deployId))
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
