// Plan SC: SVC-AI-ADV-R640
// Design Ref: §LOAD_BALANCE — 발전원별 공급/수요 균형 + 예비율 유지 알고리즘

type DataGrade = 'O' | 'C' | 'S'
type SourceType = 'nuclear' | 'thermal' | 'hydro' | 'solar' | 'wind' | 'battery'

interface PowerSource {
  sourceId: string
  type: SourceType
  maxOutputMW: number
  currentOutputMW: number
  rampRate: number
  available: boolean
}

interface GridState {
  timestamp: string
  demandMW: number
  supplyMW: number
  reserveRatio: number
  balanced: boolean
  dispatchPlan: Array<{ sourceId: string; targetMW: number }>
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

const DISPATCH_PRIORITY: Record<SourceType, number> = {
  nuclear: 1,
  hydro: 2,
  wind: 3,
  solar: 4,
  thermal: 5,
  battery: 6,
}

export class AISmartGridBalancer {
  private sources = new Map<string, PowerSource>()
  private auditLog: AuditEntry[] = []

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerSource(source: PowerSource): PowerSource {
    this.sources.set(source.sourceId, source)
    this.log('source.register', `sourceId=${source.sourceId} type=${source.type}`)
    return source
  }

  balance(demandMW: number, grade: DataGrade = 'O'): GridState {
    blockClassifiedData(grade)
    const sorted = Array.from(this.sources.values())
      .filter((s) => s.available)
      .sort((a, b) => DISPATCH_PRIORITY[a.type] - DISPATCH_PRIORITY[b.type])

    const plan: GridState['dispatchPlan'] = []
    let remaining = demandMW * 1.1
    let supplyMW = 0

    for (const source of sorted) {
      if (remaining <= 0) {
        plan.push({ sourceId: source.sourceId, targetMW: 0 })
        continue
      }
      const target = Math.min(source.maxOutputMW, remaining)
      plan.push({ sourceId: source.sourceId, targetMW: Math.round(target * 10) / 10 })
      supplyMW += target
      remaining -= target
    }

    const reserveRatio = demandMW > 0 ? (supplyMW - demandMW) / demandMW : 0
    const balanced = supplyMW >= demandMW && reserveRatio >= 0.05

    const state: GridState = {
      timestamp: new Date().toISOString(),
      demandMW,
      supplyMW: Math.round(supplyMW * 10) / 10,
      reserveRatio: Math.round(reserveRatio * 1000) / 1000,
      balanced,
      dispatchPlan: plan,
    }

    this.log('grid.balance', `demand=${demandMW} supply=${state.supplyMW} reserve=${state.reserveRatio}`)
    return state
  }

  setSourceOutput(sourceId: string, outputMW: number): void {
    const s = this.sources.get(sourceId)
    if (!s) throw new Error('source 없음')
    if (outputMW < 0 || outputMW > s.maxOutputMW) {
      throw new Error('outputMW out of range')
    }
    s.currentOutputMW = outputMW
    this.log('source.output', `sourceId=${sourceId} output=${outputMW}`)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
