// Design Ref: §우선순위 점수 — SecurityPatchPrioritizerV2
// Plan SC: SVC-AI-ADV-R500

type PatchStatus = 'pending' | 'applied' | 'deferred'

interface SecurityPatch {
  patchId: string
  title: string
  cvssScore: number
  affectedSystems: string[]
  status: PatchStatus
}

interface AuditEntry {
  timestamp: string
  action: string
  patchId: string
  details?: Record<string, unknown>
}

export class SecurityPatchPrioritizerV2 {
  private patches = new Map<string, SecurityPatch>()
  private auditLog: AuditEntry[] = []

  registerPatch(
    patchId: string,
    title: string,
    cvssScore: number,
    affectedSystems: string[]
  ): SecurityPatch {
    const patch: SecurityPatch = { patchId, title, cvssScore, affectedSystems, status: 'pending' }
    this.patches.set(patchId, patch)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_PATCH',
      patchId,
      details: { title, cvssScore, affectedSystemsCount: affectedSystems.length },
    })
    return patch
  }

  updateStatus(patchId: string, status: PatchStatus, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const patch = this.patches.get(patchId)
    if (!patch) throw new Error(`패치를 찾을 수 없습니다: ${patchId}`)
    patch.status = status
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'UPDATE_STATUS',
      patchId,
      details: { status },
    })
  }

  getPriorityScore(patchId: string): number {
    const patch = this.patches.get(patchId)
    if (!patch) throw new Error(`패치를 찾을 수 없습니다: ${patchId}`)
    return patch.cvssScore * 10 + patch.affectedSystems.length * 5
  }

  getPrioritizedPatches(): SecurityPatch[] {
    return Array.from(this.patches.values()).sort(
      (a, b) => this.getPriorityScore(b.patchId) - this.getPriorityScore(a.patchId)
    )
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
