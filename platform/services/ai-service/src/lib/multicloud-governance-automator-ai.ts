// Design Ref: §R427 — Public Asset Manager AI
// Plan SC: SC-R427

export type Condition = 'GOOD' | 'FAIR' | 'BAD'

export interface Asset {
  readonly assetId: string
  readonly elapsedYears: number
  readonly usefulLifeYears: number
  readonly condition: Condition
}

export type Recommendation = 'KEEP' | 'REVIEW' | 'DISPOSE'

export interface AssetAdvice {
  readonly assetId: string
  readonly ageRatio: number
  readonly recommendation: Recommendation
  readonly reasonCode: string
}

export interface AssetManagementReport {
  readonly totalAssets: number
  readonly disposeCount: number
  readonly reviewCount: number
  readonly advices: AssetAdvice[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class MulticloudGovernanceAutomatorAi {
  private assets: Asset[] = []
  private auditLog: AuditEntry[] = []

  registerAsset(asset: Asset): void {
    this.assets.push(asset)
    this.auditLog.push({ action: 'asset.register', timestamp: new Date().toISOString(), detail: asset.assetId })
  }

  evaluate(): AssetManagementReport {
    const advices: AssetAdvice[] = []

    for (const asset of this.assets) {
      const ageRatio = asset.usefulLifeYears > 0 ? Math.round((asset.elapsedYears / asset.usefulLifeYears) * 100) / 100 : 1

      let recommendation: Recommendation
      let reasonCode: string

      if (asset.condition === 'BAD') {
        recommendation = 'DISPOSE'
        reasonCode = 'BAD_CONDITION'
      } else if (ageRatio < 0.7) {
        recommendation = 'KEEP'
        reasonCode = 'WITHIN_USEFUL_LIFE'
      } else if (ageRatio < 1.0) {
        recommendation = 'REVIEW'
        reasonCode = 'APPROACHING_EOL'
      } else {
        recommendation = 'DISPOSE'
        reasonCode = 'EOL'
      }

      advices.push({ assetId: asset.assetId, ageRatio, recommendation, reasonCode })
    }

    const disposeCount = advices.filter((a) => a.recommendation === 'DISPOSE').length
    const reviewCount = advices.filter((a) => a.recommendation === 'REVIEW').length

    this.auditLog.push({ action: 'asset.evaluate', timestamp: new Date().toISOString(), detail: `dispose=${disposeCount}` })
    return { totalAssets: this.assets.length, disposeCount, reviewCount, advices }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
