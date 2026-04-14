// Design Ref: §R589 — AI기반 공공기관 디지털 트윈 서비스
// Plan SC: SVC-AI-ADV-R589-SC01

export type AssetType = 'SERVER' | 'NETWORK_DEVICE' | 'SENSOR' | 'VEHICLE' | 'BUILDING_SYSTEM'
export type AssetOperationalStatus = 'NORMAL' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE' | 'MAINTENANCE'
export type SimulationScenario = 'OVERLOAD' | 'FAILURE' | 'MAINTENANCE' | 'PEAK_LOAD' | 'RECOVERY'

export interface PhysicalAsset {
  assetId: string
  name: string
  assetType: AssetType
  location: string
  installedAt: string
  normalOperatingRange: {
    temperatureMin: number
    temperatureMax: number
    loadMin: number
    loadMax: number
  }
}

export interface AssetState {
  assetId: string
  timestamp: string
  temperatureCelsius: number
  loadPct: number
  powerConsumptionKw: number
  operationalStatus: AssetOperationalStatus
  alerts: string[]
}

export interface SimulationResult {
  assetId: string
  scenario: SimulationScenario
  predictedStatus: AssetOperationalStatus
  predictedTemperature: number
  predictedLoad: number
  riskFactors: string[]
  mitigationActions: string[]
  simulatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  assetId: string
  detail: Record<string, unknown>
}

export class DigitalTwinServiceAI {
  private assets = new Map<string, PhysicalAsset>()
  private states = new Map<string, AssetState>()
  private auditLog: AuditEntry[] = []

  registerPhysicalAsset(asset: PhysicalAsset): void {
    this.assets.set(asset.assetId, asset)
    this.appendAudit('asset.register', asset.assetId, { name: asset.name, type: asset.assetType })
  }

  syncState(assetId: string, state: AssetState): void {
    const asset = this.assets.get(assetId)
    if (!asset) throw new Error(`Unknown asset: ${assetId}`)
    const alerts: string[] = []
    if (state.temperatureCelsius > asset.normalOperatingRange.temperatureMax) {
      alerts.push(`온도 ${state.temperatureCelsius}°C — 정상 범위(최대 ${asset.normalOperatingRange.temperatureMax}°C) 초과`)
    }
    if (state.loadPct > asset.normalOperatingRange.loadMax) {
      alerts.push(`부하 ${state.loadPct}% — 정상 범위(최대 ${asset.normalOperatingRange.loadMax}%) 초과`)
    }
    this.states.set(assetId, { ...state, alerts })
    this.appendAudit('state.sync', assetId, { status: state.operationalStatus, temperature: state.temperatureCelsius })
  }

  simulate(assetId: string, scenario: SimulationScenario): SimulationResult {
    const asset = this.assets.get(assetId)
    if (!asset) throw new Error(`Unknown asset: ${assetId}`)
    const currentState = this.states.get(assetId)

    const baseTemp = currentState?.temperatureCelsius ?? (asset.normalOperatingRange.temperatureMin + asset.normalOperatingRange.temperatureMax) / 2
    const baseLoad = currentState?.loadPct ?? 50

    const result = this.runSimulation(asset, scenario, baseTemp, baseLoad)
    this.appendAudit('simulation.run', assetId, { scenario, predictedStatus: result.predictedStatus })
    return result
  }

  getDigitalState(assetId: string): AssetState {
    const state = this.states.get(assetId)
    if (!state) throw new Error(`No state for asset: ${assetId}`)
    return { ...state }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private runSimulation(asset: PhysicalAsset, scenario: SimulationScenario, baseTemp: number, baseLoad: number): SimulationResult {
    const riskFactors: string[] = []
    const mitigationActions: string[] = []
    let predictedTemp = baseTemp
    let predictedLoad = baseLoad
    let predictedStatus: AssetOperationalStatus = 'NORMAL'

    switch (scenario) {
      case 'OVERLOAD':
        predictedLoad = Math.min(100, baseLoad * 1.5)
        predictedTemp = baseTemp + 15
        if (predictedLoad > asset.normalOperatingRange.loadMax) {
          riskFactors.push(`과부하 위험: 예측 부하 ${predictedLoad.toFixed(0)}%`)
          mitigationActions.push('부하 분산 또는 용량 증설 즉시 검토')
          predictedStatus = 'CRITICAL'
        }
        break
      case 'FAILURE':
        predictedStatus = 'OFFLINE'
        riskFactors.push('장애 시나리오 — 서비스 중단 예상')
        mitigationActions.push('자동 페일오버 활성화', '백업 장비 즉시 전환')
        break
      case 'MAINTENANCE':
        predictedStatus = 'MAINTENANCE'
        mitigationActions.push('유지보수 기간 중 대체 시스템 운영')
        break
      case 'PEAK_LOAD':
        predictedLoad = Math.min(100, baseLoad * 1.3)
        predictedTemp = baseTemp + 8
        if (predictedLoad > 80) {
          riskFactors.push(`최대 부하 도달 위험: ${predictedLoad.toFixed(0)}%`)
          mitigationActions.push('사전 스케일 아웃 준비')
          predictedStatus = 'DEGRADED'
        }
        break
      case 'RECOVERY':
        predictedLoad = baseLoad * 0.7
        predictedTemp = baseTemp - 5
        predictedStatus = 'NORMAL'
        mitigationActions.push('복구 후 정상 모니터링 지속')
        break
    }

    return {
      assetId: asset.assetId,
      scenario,
      predictedStatus,
      predictedTemperature: Math.round(predictedTemp * 10) / 10,
      predictedLoad: Math.round(predictedLoad),
      riskFactors,
      mitigationActions,
      simulatedAt: new Date().toISOString(),
    }
  }

  private appendAudit(action: string, assetId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, assetId, detail })
  }
}
