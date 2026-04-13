// Plan SC: SVC-AI-ADV-R469
// Design Ref: §만료조건 — createdAt + retentionYears*365일(ms) < currentDate
type DataGrade = 'O' | 'C' | 'S'

interface DataRecord {
  dataId: string
  name: string
  category: string
  retentionYears: number
  createdAt: Date
  status: 'active' | 'disposed'
}

interface AuditEntry { action: string; detail: string; timestamp: string }

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000

export class PublicDataLifecycleManagerV2 {
  private records = new Map<string, DataRecord>()
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerData(
    dataId: string,
    name: string,
    category: string,
    retentionYears: number,
    createdAt?: Date | string
  ): DataRecord {
    const createdDate = createdAt instanceof Date
      ? createdAt
      : createdAt
        ? new Date(createdAt)
        : new Date()
    const record: DataRecord = { dataId, name, category, retentionYears, createdAt: createdDate, status: 'active' }
    this.records.set(dataId, record)
    this.log('data.register', `dataId=${dataId} retentionYears=${retentionYears}`)
    return record
  }

  getExpiredData(currentDate: Date = new Date()): DataRecord[] {
    return Array.from(this.records.values()).filter((r) => {
      if (r.status === 'disposed') return false
      return r.createdAt.getTime() + r.retentionYears * MS_PER_YEAR < currentDate.getTime()
    })
  }

  disposeData(dataId: string, dataGrade?: DataGrade): void {
    this.checkGrade(dataGrade)
    const record = this.records.get(dataId)
    if (!record) throw new Error('dataId 없음')
    record.status = 'disposed'
    this.log('data.dispose', `dataId=${dataId}`)
  }

  getActiveData(): DataRecord[] {
    return Array.from(this.records.values()).filter((r) => r.status === 'active')
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
