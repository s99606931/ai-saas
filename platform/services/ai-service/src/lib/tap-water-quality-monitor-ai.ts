// Plan SC: SVC-AI-ADV-R631
// Design Ref: §QUALITY_GRADE — 상수도 수질 지표(ph, 탁도, 잔류염소)별 등급 판정

type DataGrade = 'O' | 'C' | 'S'
type QualityGrade = 'excellent' | 'good' | 'warning' | 'unsafe'

interface WaterSample {
  sampleId: string
  facilityCode: string
  ph: number
  turbidity: number
  residualChlorine: number
  collectedAt: string
}

interface QualityAssessment {
  sampleId: string
  grade: QualityGrade
  score: number
  issues: string[]
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

export class TapWaterQualityMonitorAI {
  private samples = new Map<string, WaterSample>()
  private auditLog: AuditEntry[] = []

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerSample(sample: WaterSample, grade: DataGrade = 'O'): WaterSample {
    blockClassifiedData(grade)
    this.samples.set(sample.sampleId, sample)
    this.log('sample.register', `sampleId=${sample.sampleId} facility=${sample.facilityCode}`)
    return sample
  }

  assess(sampleId: string): QualityAssessment {
    const sample = this.samples.get(sampleId)
    if (!sample) throw new Error('sample 없음')

    const issues: string[] = []
    let score = 100

    if (sample.ph < 5.8 || sample.ph > 8.5) {
      issues.push('pH 기준 초과')
      score -= 35
    } else if (sample.ph < 6.5 || sample.ph > 8.0) {
      score -= 10
    }

    if (sample.turbidity > 1.0) {
      issues.push('탁도 초과 (>1 NTU)')
      score -= 30
    } else if (sample.turbidity > 0.5) {
      score -= 10
    }

    if (sample.residualChlorine < 0.1) {
      issues.push('잔류염소 부족')
      score -= 25
    } else if (sample.residualChlorine > 4.0) {
      issues.push('잔류염소 과다')
      score -= 20
    }

    const finalScore = Math.max(0, score)
    const grade: QualityGrade =
      finalScore >= 90 ? 'excellent' : finalScore >= 70 ? 'good' : finalScore >= 50 ? 'warning' : 'unsafe'

    this.log('sample.assess', `sampleId=${sampleId} grade=${grade} score=${finalScore}`)
    return { sampleId, grade, score: finalScore, issues }
  }

  listUnsafe(): QualityAssessment[] {
    const results: QualityAssessment[] = []
    for (const sample of this.samples.values()) {
      const a = this.assess(sample.sampleId)
      if (a.grade === 'unsafe') results.push(a)
    }
    return results
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
