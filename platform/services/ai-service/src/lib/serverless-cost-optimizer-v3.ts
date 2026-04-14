// Design Ref: SVC-AI-ADV-R620 — AI기반 서버리스 비용 최적화 v2 (impl v3)
// Plan SC: FR-R620.1~5
import { createHash } from 'crypto'

interface FunctionMetrics {
  functionId: string
  memoryMB: number
  avgDurationMs: number
  invocationsPerDay: number
  allocatedMemoryMB: number
}

interface AuditEntry {
  timestamp: string
  action: string
  actor?: string
  details?: Record<string, unknown>
}

interface OptimizationResult {
  functionId: string
  recommendedMemoryMB: number
  estimatedMonthlySavings: number
  action: 'DOWNSIZE' | 'UPSIZE' | 'KEEP'
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

export class ServerlessCostOptimizerV3 {
  private metrics = new Map<string, FunctionMetrics>()
  private auditLog: AuditEntry[] = []
  // GB-second rate (placeholder unit price — no hardcoded secrets)
  private readonly gbSecondRate = 0.0000166667

  recordMetrics(
    functionId: string,
    memoryMB: number,
    avgDurationMs: number,
    invocationsPerDay: number,
    allocatedMemoryMB: number,
    dataGrade?: 'C' | 'S' | 'O',
  ): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.metrics.set(functionId, {
      functionId,
      memoryMB,
      avgDurationMs,
      invocationsPerDay,
      allocatedMemoryMB,
    })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_METRICS',
      actor: maskPII(functionId),
      details: { memoryMB, avgDurationMs, allocatedMemoryMB },
    })
  }

  optimize(functionId: string): OptimizationResult | null {
    const m = this.metrics.get(functionId)
    if (!m) return null
    const utilization = m.memoryMB / m.allocatedMemoryMB
    let recommendedMemoryMB = m.allocatedMemoryMB
    let action: 'DOWNSIZE' | 'UPSIZE' | 'KEEP' = 'KEEP'
    if (utilization < 0.5) {
      recommendedMemoryMB = Math.max(128, Math.ceil((m.memoryMB * 1.2) / 64) * 64)
      action = 'DOWNSIZE'
    } else if (utilization > 0.9) {
      recommendedMemoryMB = Math.ceil((m.allocatedMemoryMB * 1.5) / 64) * 64
      action = 'UPSIZE'
    }
    const currentGBs = (m.allocatedMemoryMB / 1024) * (m.avgDurationMs / 1000) * m.invocationsPerDay * 30
    const newGBs = (recommendedMemoryMB / 1024) * (m.avgDurationMs / 1000) * m.invocationsPerDay * 30
    const estimatedMonthlySavings = Math.round((currentGBs - newGBs) * this.gbSecondRate * 10000) / 10000

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'OPTIMIZE',
      actor: maskPII(functionId),
      details: { action, recommendedMemoryMB, estimatedMonthlySavings },
    })
    return { functionId: maskPII(functionId), recommendedMemoryMB, estimatedMonthlySavings, action }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
