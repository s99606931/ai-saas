// Plan SC: SVC-AI-ADV-R633
// Design Ref: §RELIEF_TABLE — 재해유형별 보상률 및 손실면적 가중치

type DataGrade = 'O' | 'C' | 'S'
type DisasterType = 'typhoon' | 'drought' | 'flood' | 'frost' | 'hail'

interface DamageReport {
  reportId: string
  farmerId: string
  disasterType: DisasterType
  affectedAreaHa: number
  cropValuePerHa: number
  lossRatio: number
}

interface ReliefDecision {
  reportId: string
  estimatedLoss: number
  reliefAmount: number
  priority: 'urgent' | 'normal' | 'standard'
  approved: boolean
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

const RELIEF_TABLE: Record<DisasterType, number> = {
  typhoon: 0.8,
  flood: 0.75,
  drought: 0.6,
  frost: 0.65,
  hail: 0.7,
}

export class AgriculturalDisasterReliefAI {
  private reports = new Map<string, DamageReport>()
  private auditLog: AuditEntry[] = []

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  submitReport(report: DamageReport, grade: DataGrade = 'O'): DamageReport {
    blockClassifiedData(grade)
    if (report.lossRatio < 0 || report.lossRatio > 1) {
      throw new Error('lossRatio must be between 0 and 1')
    }
    this.reports.set(report.reportId, report)
    this.log('report.submit', `reportId=${report.reportId} disaster=${report.disasterType}`)
    return report
  }

  evaluateRelief(reportId: string): ReliefDecision {
    const report = this.reports.get(reportId)
    if (!report) throw new Error('report 없음')

    const estimatedLoss = report.affectedAreaHa * report.cropValuePerHa * report.lossRatio
    const rate = RELIEF_TABLE[report.disasterType]
    const reliefAmount = Math.round(estimatedLoss * rate)
    const priority: ReliefDecision['priority'] =
      estimatedLoss >= 10000000 ? 'urgent' : estimatedLoss >= 3000000 ? 'normal' : 'standard'
    const approved = reliefAmount > 0 && report.lossRatio >= 0.1

    this.log(
      'relief.evaluate',
      `reportId=${reportId} amount=${reliefAmount} priority=${priority}`,
    )
    return { reportId, estimatedLoss, reliefAmount, priority, approved }
  }

  listUrgent(): ReliefDecision[] {
    const results: ReliefDecision[] = []
    for (const report of this.reports.values()) {
      const d = this.evaluateRelief(report.reportId)
      if (d.priority === 'urgent') results.push(d)
    }
    return results
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
