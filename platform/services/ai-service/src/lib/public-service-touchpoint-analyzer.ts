// Plan SC: SVC-AI-ADV-R443
// Design Ref: §PII마스킹 — citizenId SHA-256 16자 hex 마스킹
import { createHash } from 'crypto'

type DataGrade = 'O' | 'C' | 'S'

interface Touchpoint {
  touchpointId: string
  name: string
  channel: string
}

interface Interaction {
  touchpointId: string
  maskedCitizenId: string
  satisfactionScore: number
  waitTimeMs: number
}

interface TouchpointStats {
  avgSatisfaction: number
  avgWaitTimeMs: number
  count: number
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

export class PublicServiceTouchpointAnalyzer {
  private touchpoints = new Map<string, Touchpoint>()
  private interactions: Interaction[] = []
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
  }

  private maskId(id: string): string {
    return createHash('sha256').update(id).digest('hex').substring(0, 16)
  }

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerTouchpoint(touchpointId: string, name: string, channel: string): Touchpoint {
    const tp: Touchpoint = { touchpointId, name, channel }
    this.touchpoints.set(touchpointId, tp)
    this.log('touchpoint.register', `touchpointId=${touchpointId} channel=${channel}`)
    return tp
  }

  recordInteraction(
    touchpointId: string,
    citizenId: string,
    satisfactionScore: number,
    waitTimeMs: number,
    dataGrade?: DataGrade,
  ): void {
    this.checkGrade(dataGrade)
    if (!this.touchpoints.has(touchpointId)) throw new Error('touchpointId 없음')
    this.interactions.push({
      touchpointId,
      maskedCitizenId: this.maskId(citizenId),
      satisfactionScore,
      waitTimeMs,
    })
    this.log('interaction.record', `touchpointId=${touchpointId}`)
  }

  getTouchpointStats(touchpointId: string): TouchpointStats {
    const items = this.interactions.filter((i) => i.touchpointId === touchpointId)
    if (items.length === 0) return { avgSatisfaction: 0, avgWaitTimeMs: 0, count: 0 }
    return {
      avgSatisfaction: items.reduce((s, i) => s + i.satisfactionScore, 0) / items.length,
      avgWaitTimeMs: items.reduce((s, i) => s + i.waitTimeMs, 0) / items.length,
      count: items.length,
    }
  }

  getLowSatisfactionTouchpoints(threshold: number): Touchpoint[] {
    return Array.from(this.touchpoints.values()).filter(
      (tp) => this.getTouchpointStats(tp.touchpointId).avgSatisfaction < threshold,
    )
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
