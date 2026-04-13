// Design Ref: §핵심 알고리즘 — CVE 심각도 우선순위, 패치 상태 관리
// Plan SC: SVC-AI-ADV-R377
export type DataGrade = 'O' | 'C' | 'S'
export type CveSeverity = 'critical' | 'high' | 'medium' | 'low'
export type PatchStatus = 'pending' | 'applied' | 'skipped'

const SEVERITY_PRIORITY: Record<CveSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 }

export interface CveEntry {
  id: string
  severity: CveSeverity
  affectedComponent: string
  status: PatchStatus
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class SecurityPatchManagerAI {
  private cves = new Map<string, CveEntry>()
  private auditLog: AuditEntry[] = []

  registerCve(id: string, severity: CveSeverity, affectedComponent: string): void {
    if (!id || !affectedComponent) throw new Error('id와 affectedComponent는 필수')
    this.cves.set(id, { id, severity, affectedComponent, status: 'pending' })
    this.auditLog.push({ action: 'cve.register', timestamp: new Date().toISOString(), detail: `${id}:${severity}` })
  }

  updatePatchStatus(cveId: string, status: PatchStatus, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 패치 데이터 전송 금지 (N2SF N-05)`)
    }
    const cve = this.cves.get(cveId)
    if (!cve) throw new Error(`cveId 없음: ${cveId}`)
    cve.status = status
    this.auditLog.push({ action: 'patch.update', timestamp: new Date().toISOString(), detail: `${cveId}:${status}` })
  }

  getPriorityList(): CveEntry[] {
    return [...this.cves.values()]
      .filter((c) => c.status === 'pending')
      .sort((a, b) => SEVERITY_PRIORITY[b.severity] - SEVERITY_PRIORITY[a.severity])
  }

  getPendingCritical(): CveEntry[] {
    return [...this.cves.values()].filter((c) => c.severity === 'critical' && c.status === 'pending')
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
