/**
 * Auto Remediation Engine V3 — SVC-AI-ADV-R662 (트랙 A 24차)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R662.design.md
 * Plan SC: FR-R662.1 ~ FR-R662.6
 *
 * 장애 시그널 → 표준 복구 플레이북 자동 적용.
 * N2SF N-05: C/S 등급 차단.
 */

export type DataGrade = 'C' | 'S' | 'O'
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface Playbook {
  playbookId: string
  signalType: string
  minSeverity: Severity
  priority: number
  action: string
}

export interface Signal {
  signalId: string
  signalType: string
  severity: Severity
  receivedAt: string
}

export interface Execution {
  playbookId: string
  signalId: string
  success: boolean
  timestamp: string
  error?: string
}

export interface Stats {
  total: number
  successes: number
  failures: number
  successRate: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  playbookId: string
  detail: Record<string, unknown>
}

const SEVERITY_RANK: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }

export class AutoRemediationEngineV3 {
  private readonly playbooks = new Map<string, Playbook>()
  private readonly executions: Execution[] = []
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R662.1
  registerPlaybook(playbook: Playbook): Playbook {
    if (this.playbooks.has(playbook.playbookId)) {
      throw new Error(`Playbook already exists: ${playbook.playbookId}`)
    }
    this.playbooks.set(playbook.playbookId, { ...playbook })
    this.appendAudit('playbook.register', playbook.playbookId, { signalType: playbook.signalType })
    return { ...playbook }
  }

  // Plan SC: FR-R662.2 + FR-R662.3
  matchPlaybooks(signal: Signal, dataGrade: DataGrade = 'O'): Playbook[] {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const sigRank = SEVERITY_RANK[signal.severity]
    return [...this.playbooks.values()]
      .filter((p) => p.signalType === signal.signalType && SEVERITY_RANK[p.minSeverity] <= sigRank)
      .sort((a, b) => b.priority - a.priority)
      .map((p) => ({ ...p }))
  }

  // Plan SC: FR-R662.4
  executePlaybook(
    playbookId: string,
    signalId: string,
    executor: (action: string) => boolean,
  ): Execution {
    const playbook = this.playbooks.get(playbookId)
    if (!playbook) throw new Error(`Unknown playbook: ${playbookId}`)
    let success = false
    let error: string | undefined
    try {
      success = executor(playbook.action)
    } catch (e) {
      success = false
      error = e instanceof Error ? e.message : String(e)
    }
    const execution: Execution = {
      playbookId,
      signalId,
      success,
      timestamp: new Date().toISOString(),
      ...(error !== undefined && { error }),
    }
    this.executions.push(execution)
    this.appendAudit('playbook.execute', playbookId, { signalId, success })
    return { ...execution }
  }

  // Plan SC: FR-R662.5
  getStats(): Stats {
    const total = this.executions.length
    const successes = this.executions.filter((e) => e.success).length
    const failures = total - successes
    const successRate = total === 0 ? 0 : successes / total
    return { total, successes, failures, successRate }
  }

  // Plan SC: FR-R662.6 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, playbookId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, playbookId, detail })
  }
}
