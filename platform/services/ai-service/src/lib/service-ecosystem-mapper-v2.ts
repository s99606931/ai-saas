// Design Ref: §클래스 설계 — ServiceEcosystemMapperV2
// Plan SC: SVC-AI-ADV-R494

import { createHash } from 'crypto'

interface ServiceNode {
  nodeId: string
  name: string
  serviceType: string
}

interface Dependency {
  fromId: string
  toId: string
  dependencyType: string
}

interface AuditEntry {
  timestamp: string
  action: string
  nodeId: string
  maskedNodeId?: string
  details?: Record<string, unknown>
}

export class ServiceEcosystemMapperV2 {
  private nodes = new Map<string, ServiceNode>()
  private dependencies: Dependency[] = []
  private auditLog: AuditEntry[] = []

  registerNode(nodeId: string, name: string, serviceType: string): ServiceNode {
    const node: ServiceNode = { nodeId, name, serviceType }
    this.nodes.set(nodeId, node)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_NODE',
      nodeId,
      details: { name, serviceType },
    })
    return node
  }

  addDependency(fromId: string, toId: string, dependencyType: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.dependencies.push({ fromId, toId, dependencyType })
    const maskedNodeId = createHash('sha256').update(fromId).digest('hex').substring(0, 16)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ADD_DEPENDENCY',
      nodeId: fromId,
      maskedNodeId,
      details: { toId, dependencyType },
    })
  }

  getServiceDependencies(nodeId: string): Dependency[] {
    return this.dependencies.filter((d) => d.fromId === nodeId || d.toId === nodeId)
  }

  getHighDependencyNodes(threshold: number): ServiceNode[] {
    return Array.from(this.nodes.values()).filter((node) => {
      const inboundCount = this.dependencies.filter((d) => d.toId === node.nodeId).length
      return inboundCount >= threshold
    })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
