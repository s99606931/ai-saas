/**
 * Security Patch Prioritizer — SVC-AI-ADV-R105
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R105.design.md
 * Plan SC: FR-R105.1 ~ FR-R105.5
 *
 * CVSS + EPSS + 노출도 + 자산중요도 종합 패치 우선순위 결정.
 */

export interface Vulnerability {
  id: string
  cvssScore: number
  epssScore: number
  affectedAssetIds: string[]
}

export interface Asset {
  id: string
  criticality: number
  internetFacing: boolean
}

export type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4'

export interface PriorityItem {
  vuln: Vulnerability
  score: number
  priority: Priority
  rationale: string
}

export interface Weights {
  cvss: number
  epss: number
  exposure: number
  criticality: number
}

const DEFAULT_WEIGHTS: Weights = {
  cvss: 0.4,
  epss: 0.2,
  exposure: 0.2,
  criticality: 0.2,
}

export class SecurityPatchPrioritizer {
  private readonly weights: Weights

  constructor(weights: Partial<Weights> = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights }
    // Normalize weights to sum to 1
    const sum =
      this.weights.cvss +
      this.weights.epss +
      this.weights.exposure +
      this.weights.criticality
    if (sum > 0 && Math.abs(sum - 1) > 1e-6) {
      this.weights.cvss /= sum
      this.weights.epss /= sum
      this.weights.exposure /= sum
      this.weights.criticality /= sum
    }
  }

  /**
   * FR-R105.1~4: 우선순위 결정.
   */
  prioritize(
    vulns: Vulnerability[],
    assets: Asset[],
  ): PriorityItem[] {
    const assetMap = new Map(assets.map((a) => [a.id, a]))
    const items = vulns.map((v) => this.score(v, assetMap))
    items.sort((a, b) => b.score - a.score)
    return items
  }

  private score(
    vuln: Vulnerability,
    assetMap: Map<string, Asset>,
  ): PriorityItem {
    const affected = vuln.affectedAssetIds
      .map((id) => assetMap.get(id))
      .filter((a): a is Asset => a !== undefined)

    const cvssTerm = Math.min(100, vuln.cvssScore * 10)
    const epssTerm = Math.min(100, vuln.epssScore * 100)

    const internetFacing = affected.some((a) => a.internetFacing)
    const exposureTerm = internetFacing ? 100 : 20

    const maxCriticality = affected.reduce(
      (acc, a) => Math.max(acc, a.criticality),
      0,
    )
    const criticalityTerm = Math.min(100, maxCriticality * 10)

    const score =
      this.weights.cvss * cvssTerm +
      this.weights.epss * epssTerm +
      this.weights.exposure * exposureTerm +
      this.weights.criticality * criticalityTerm

    const priority = this.classify(score)
    const rationale = [
      `CVSS=${vuln.cvssScore}`,
      `EPSS=${vuln.epssScore.toFixed(2)}`,
      `exposure=${internetFacing ? 'internet' : 'internal'}`,
      `maxCriticality=${maxCriticality}`,
    ].join(', ')

    return { vuln, score: Math.round(score * 10) / 10, priority, rationale }
  }

  private classify(score: number): Priority {
    if (score >= 85) return 'P0'
    if (score >= 70) return 'P1'
    if (score >= 50) return 'P2'
    if (score >= 30) return 'P3'
    return 'P4'
  }
}
