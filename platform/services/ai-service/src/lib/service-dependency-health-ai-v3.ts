// Design Ref: SVC-AI-ADV-R671.design.md — AI기반 서비스 의존성 상태 관리 v3
// Plan SC: FR-R671.1~5

import { createHash } from 'crypto';

export type NodeStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN';
export type EffectiveStatus = NodeStatus | 'IMPACTED';

interface ServiceNode {
  name: string;
  status: NodeStatus;
  dependsOn: string[];
}
interface EvaluatedNode {
  maskedName: string;
  status: NodeStatus;
  effectiveStatus: EffectiveStatus;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function mask(v: string): string {
  return createHash('sha256').update(v).digest('hex').substring(0, 16);
}

export class ServiceDependencyHealthAIV3 {
  private auditLog: AuditEntry[] = [];
  private nodes: Map<string, ServiceNode> = new Map();

  register(node: ServiceNode): void {
    this.nodes.set(node.name, node);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_NODE',
      details: { masked: mask(node.name), status: node.status },
    });
  }

  evaluate(dataGrade?: string): EvaluatedNode[] {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const results: EvaluatedNode[] = [];
    for (const node of this.nodes.values()) {
      let effective: EffectiveStatus = node.status;
      if (node.status !== 'DOWN') {
        const hasDownDep = node.dependsOn.some((dep) => {
          const d = this.nodes.get(dep);
          return d?.status === 'DOWN';
        });
        if (hasDownDep) effective = 'IMPACTED';
      }
      results.push({
        maskedName: mask(node.name),
        status: node.status,
        effectiveStatus: effective,
      });
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'EVALUATE',
      details: { count: results.length },
    });
    return results;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
