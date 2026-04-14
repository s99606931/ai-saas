// Design Ref: §설계결정 — AI기반 공공기관 민원 자동 라우팅 v2
// Plan SC: FR-R582.1~5
import { createHash } from 'crypto'

interface Department { deptId: string; name: string; categories: string[] }
interface ComplaintRecord { complaintId: string; maskedCitizenId: string; category: string; assignedDeptId: string | null; resolved: boolean }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ComplaintAutoRouterV2 {
  private departments = new Map<string, Department>()
  private complaints = new Map<string, ComplaintRecord>()
  private auditLog: AuditEntry[] = []

  registerDepartment(deptId: string, name: string, categories: string[]): void {
    this.departments.set(deptId, { deptId, name, categories })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_DEPARTMENT', details: { deptId, name } })
  }

  receiveComplaint(complaintId: string, citizenId: string, category: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const maskedCitizenId = createHash('sha256').update(citizenId).digest('hex').substring(0, 16)
    const assignedDeptId = this.routeCategory(category)
    this.complaints.set(complaintId, { complaintId, maskedCitizenId, category, assignedDeptId, resolved: false })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECEIVE_COMPLAINT', details: { complaintId, maskedCitizenId, category, assignedDeptId } })
  }

  private routeCategory(category: string): string | null {
    for (const dept of this.departments.values()) {
      if (dept.categories.includes(category)) return dept.deptId
    }
    return null
  }

  getAssignedDepartment(complaintId: string): string | null {
    return this.complaints.get(complaintId)?.assignedDeptId ?? null
  }

  getPendingComplaints(): ComplaintRecord[] {
    return Array.from(this.complaints.values()).filter(c => !c.resolved)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
