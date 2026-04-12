// Design Ref: §R201 — AI기반 코드 취약점 자동 패치
// Plan SC: SVC-AI-ADV-R201-SC01

export type PatchSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type PatchStrategy = 'AUTO' | 'SEMI_AUTO' | 'MANUAL'
export type PatchStatus = 'APPLIED' | 'PENDING' | 'REJECTED' | 'FAILED'

export interface CodeVuln {
  vulnId: string
  cve?: string
  packageName: string
  currentVersion: string
  affectedVersionRange: string
  severity: PatchSeverity
  description: string
}

export interface PatchCandidate {
  vulnId: string
  targetVersion: string
  strategy: PatchStrategy
  breakingChanges: boolean
  testRequired: boolean
}

export interface PatchResult {
  vulnId: string
  status: PatchStatus
  appliedVersion?: string
  strategy: PatchStrategy
  notes: string
}

interface AuditEntry {
  timestamp: string
  action: string
  vulnId: string
  detail: Record<string, unknown>
}

export class CodeVulnAutoPatcher {
  private vulns = new Map<string, CodeVuln>()
  private patches = new Map<string, PatchCandidate>()
  private auditLog: AuditEntry[] = []

  registerVuln(vuln: CodeVuln): void {
    this.vulns.set(vuln.vulnId, vuln)
    this.appendAudit('vuln.register', vuln.vulnId, { severity: vuln.severity, package: vuln.packageName })
  }

  suggestPatch(vulnId: string, targetVersion: string): PatchCandidate {
    const vuln = this.vulns.get(vulnId)
    if (!vuln) throw new Error(`Unknown vulnerability: ${vulnId}`)

    // Determine strategy based on severity and version jump
    const currentMajor = parseInt(vuln.currentVersion.split('.')[0] ?? '0', 10)
    const targetMajor = parseInt(targetVersion.split('.')[0] ?? '0', 10)
    const isMajorBump = targetMajor > currentMajor
    const breakingChanges = isMajorBump

    let strategy: PatchStrategy
    if (vuln.severity === 'CRITICAL' && !breakingChanges) {
      strategy = 'AUTO'
    } else if (vuln.severity === 'HIGH' && !breakingChanges) {
      strategy = 'AUTO'
    } else if (breakingChanges) {
      strategy = 'MANUAL'
    } else {
      strategy = 'SEMI_AUTO'
    }

    const candidate: PatchCandidate = {
      vulnId,
      targetVersion,
      strategy,
      breakingChanges,
      testRequired: breakingChanges || vuln.severity === 'CRITICAL',
    }

    this.patches.set(vulnId, candidate)
    this.appendAudit('patch.suggest', vulnId, { targetVersion, strategy, breakingChanges })
    return candidate
  }

  applyPatch(vulnId: string): PatchResult {
    const candidate = this.patches.get(vulnId)
    if (!candidate) throw new Error(`패치 후보 없음: ${vulnId}`)

    if (candidate.strategy === 'MANUAL') {
      const result: PatchResult = {
        vulnId,
        status: 'PENDING',
        strategy: 'MANUAL',
        notes: '수동 패치 적용 필요 — 주요 버전 변경으로 호환성 검토 필수',
      }
      this.appendAudit('patch.apply', vulnId, { status: 'PENDING', reason: 'MANUAL_REQUIRED' })
      return result
    }

    const result: PatchResult = {
      vulnId,
      status: 'APPLIED',
      appliedVersion: candidate.targetVersion,
      strategy: candidate.strategy,
      notes: `${candidate.targetVersion}으로 패치 적용 완료`,
    }

    this.appendAudit('patch.apply', vulnId, { status: 'APPLIED', appliedVersion: candidate.targetVersion })
    return result
  }

  getPendingVulns(): CodeVuln[] {
    return [...this.vulns.values()].filter((v) => {
      const patch = this.patches.get(v.vulnId)
      return !patch || patch.strategy === 'MANUAL'
    })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, vulnId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, vulnId, detail })
  }
}
