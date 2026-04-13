// Design Ref: §핵심 알고리즘 — 단순 이동평균 예측, 스케일업 권고
// Plan SC: SVC-AI-ADV-R342
export type DataGrade = 'O' | 'C' | 'S'

export interface LoadService {
  id: string
  name: string
  scaleUpThreshold: number
  loadHistory: number[]
}

export interface LoadPrediction {
  serviceId: string
  predictedLoad: number
  scaleUpThreshold: number
  shouldScaleUp: boolean
  samplesUsed: number
}

export interface ScaleUpRecommendation {
  serviceId: string
  serviceName: string
  predictedLoad: number
  scaleUpThreshold: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class RealtimeLoadPredictionOptimizer {
  private services = new Map<string, LoadService>()
  private auditLog: AuditEntry[] = []

  registerService(id: string, name: string, scaleUpThreshold: number): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    if (scaleUpThreshold <= 0) throw new Error('scaleUpThreshold는 양수여야 합니다')
    this.services.set(id, { id, name, scaleUpThreshold, loadHistory: [] })
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordLoad(serviceId: string, loadPercent: number, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 부하 데이터 전송 금지 (N2SF N-05)`)
    }
    const svc = this.services.get(serviceId)
    if (!svc) throw new Error(`serviceId 없음: ${serviceId}`)
    svc.loadHistory.push(loadPercent)
    this.auditLog.push({ action: 'load.record', timestamp: new Date().toISOString(), detail: `${serviceId}:${loadPercent}` })
  }

  predictLoad(serviceId: string, windowSize = 5): LoadPrediction {
    const svc = this.services.get(serviceId)
    if (!svc) throw new Error(`serviceId 없음: ${serviceId}`)
    const recent = svc.loadHistory.slice(-windowSize)
    if (recent.length === 0) {
      return { serviceId, predictedLoad: 0, scaleUpThreshold: svc.scaleUpThreshold, shouldScaleUp: false, samplesUsed: 0 }
    }
    const predictedLoad = Math.round(recent.reduce((s, v) => s + v, 0) / recent.length * 100) / 100
    return {
      serviceId,
      predictedLoad,
      scaleUpThreshold: svc.scaleUpThreshold,
      shouldScaleUp: predictedLoad > svc.scaleUpThreshold,
      samplesUsed: recent.length,
    }
  }

  getScaleUpRecommendations(): ScaleUpRecommendation[] {
    const result: ScaleUpRecommendation[] = []
    for (const svc of this.services.values()) {
      const pred = this.predictLoad(svc.id)
      if (pred.shouldScaleUp) {
        result.push({ serviceId: svc.id, serviceName: svc.name, predictedLoad: pred.predictedLoad, scaleUpThreshold: svc.scaleUpThreshold })
      }
    }
    return result
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
