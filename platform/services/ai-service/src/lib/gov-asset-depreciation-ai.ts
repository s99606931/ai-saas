// Design Ref: §R502 — 정부 자산 감가상각 AI
// Plan SC: SVC-AI-ADV-R502-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION'

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export interface AssetRecord {
  assetId: string
  category: string
  acquisitionCost: number
  acquisitionDate: string // YYYY-MM-DD
  usefulLifeYears: number
  salvageValue: number
  method: DepreciationMethod
}

export interface DepreciationResult {
  assetId: string
  bookValue: number
  accumulatedDepreciation: number
  annualDepreciation: number
  remainingYears: number
  needsReplacement: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class GovAssetDepreciationAi {
  private readonly assets = new Map<string, AssetRecord>()
  private readonly auditLog: AuditEntry[] = []

  registerAsset(asset: AssetRecord, grade: DataGrade): void {
    blockClassifiedData(grade)
    if (!asset.assetId) throw new Error('assetId 필수')
    if (asset.acquisitionCost <= 0) throw new Error('acquisitionCost는 양수')
    if (asset.usefulLifeYears <= 0) throw new Error('usefulLifeYears는 양수')
    if (asset.salvageValue < 0 || asset.salvageValue >= asset.acquisitionCost) {
      throw new Error('salvageValue는 0 이상 acquisitionCost 미만')
    }
    if (this.assets.has(asset.assetId)) throw new Error(`중복 assetId: ${asset.assetId}`)
    this.assets.set(asset.assetId, { ...asset })
    this.appendAudit('asset.register', {
      assetId: asset.assetId,
      cost: asset.acquisitionCost,
      method: asset.method,
    })
  }

  computeDepreciation(assetId: string, asOfDate: string): DepreciationResult {
    const asset = this.assets.get(assetId)
    if (!asset) throw new Error(`assetId 없음: ${assetId}`)
    const yearsElapsed = this.yearsBetween(asset.acquisitionDate, asOfDate)
    if (yearsElapsed < 0) throw new Error('asOfDate가 acquisitionDate 이전')
    const depreciableBase = asset.acquisitionCost - asset.salvageValue
    let annualDepreciation: number
    let accumulated: number

    if (asset.method === 'STRAIGHT_LINE') {
      annualDepreciation = depreciableBase / asset.usefulLifeYears
      accumulated = Math.min(depreciableBase, annualDepreciation * yearsElapsed)
    } else if (asset.method === 'DECLINING_BALANCE') {
      const rate = 2 / asset.usefulLifeYears
      let bookValue = asset.acquisitionCost
      let totalDep = 0
      const years = Math.min(Math.floor(yearsElapsed), asset.usefulLifeYears)
      for (let i = 0; i < years; i++) {
        const dep = Math.max(0, (bookValue - asset.salvageValue) * rate)
        totalDep += dep
        bookValue -= dep
        if (bookValue <= asset.salvageValue) break
      }
      accumulated = Math.min(depreciableBase, totalDep)
      annualDepreciation = depreciableBase * rate
    } else {
      annualDepreciation = depreciableBase / asset.usefulLifeYears
      accumulated = Math.min(depreciableBase, annualDepreciation * yearsElapsed)
    }

    const bookValue = Math.round((asset.acquisitionCost - accumulated) * 100) / 100
    const remainingYears = Math.max(0, asset.usefulLifeYears - yearsElapsed)
    const needsReplacement = remainingYears <= 1 || bookValue <= asset.salvageValue

    this.appendAudit('depreciation.compute', { assetId, bookValue, yearsElapsed })

    return {
      assetId,
      bookValue,
      accumulatedDepreciation: Math.round(accumulated * 100) / 100,
      annualDepreciation: Math.round(annualDepreciation * 100) / 100,
      remainingYears,
      needsReplacement,
    }
  }

  listAssets(): string[] {
    return [...this.assets.keys()]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private yearsBetween(start: string, end: string): number {
    const s = new Date(start).getTime()
    const e = new Date(end).getTime()
    return (e - s) / (1000 * 60 * 60 * 24 * 365.25)
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
