/**
 * 설정 드리프트 감지기 — SVC-AI-ADV-R163
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R163/SVC-AI-ADV-R163.design.md
 * Plan SC: FR-R163.1 ~ FR-R163.6
 *
 * 인프라/앱 설정 베이스라인 대비 변경 자동 탐지 + 보안 위험 평가.
 * CSAP D-09, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export type DriftRisk = 'low' | 'medium' | 'high'

export interface DriftChange {
  field: string
  type: 'added' | 'modified' | 'removed'
  baseline: unknown
  current: unknown
  risk: DriftRisk
}

export interface DriftReport {
  configId: string
  changes: DriftChange[]
  totalChanges: number
  highRiskCount: number
  analysisAt: number
}

export interface CDDAuditEntry {
  action: 'baselineSet' | 'detected' | 'whitelistUpdated'
  configId: string
  timestamp: number
  details: Record<string, unknown>
}

const HIGH_RISK_KEYS = ['secret', 'password', 'key', 'token', 'credential', 'apikey', 'api_key']
const MEDIUM_RISK_KEYS = ['port', 'host', 'url', 'endpoint', 'address']

export class ConfigDriftDetector {
  private readonly baselines = new Map<string, Record<string, unknown>>()
  private readonly whitelist = new Set<string>()
  private readonly auditLog: CDDAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 설정 드리프트 감지기 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R163.1 */
  setBaseline(configId: string, config: Record<string, unknown>): void {
    if (!configId.trim()) throw new Error('configId must not be empty')
    this.baselines.set(configId, this.deepCopy(config))
    this.audit('baselineSet', configId, { keys: Object.keys(config).length })
  }

  /** FR-R163.3 ~ FR-R163.4 */
  detect(configId: string, current: Record<string, unknown>): DriftReport {
    const baseline = this.baselines.get(configId)
    if (!baseline) throw new Error(`no baseline for: ${configId}`)

    const changes: DriftChange[] = []
    this.compareObjects('', baseline, current, changes)

    const report: DriftReport = {
      configId,
      changes,
      totalChanges: changes.length,
      highRiskCount: changes.filter((c) => c.risk === 'high').length,
      analysisAt: Date.now(),
    }

    this.audit('detected', configId, { changes: changes.length, highRisk: report.highRiskCount })
    return report
  }

  /** FR-R163.5 */
  addWhitelistField(field: string): void {
    this.whitelist.add(field)
    this.audit('whitelistUpdated', '', { field })
  }

  /** FR-R163.6 */
  getAuditLog(): readonly CDDAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private compareObjects(
    prefix: string,
    baseline: Record<string, unknown>,
    current: Record<string, unknown>,
    changes: DriftChange[],
  ): void {
    const allKeys = new Set([...Object.keys(baseline), ...Object.keys(current)])
    for (const key of allKeys) {
      const field = prefix ? `${prefix}.${key}` : key
      if (this.whitelist.has(field) || this.whitelist.has(key)) continue

      const baseVal = baseline[key]
      const curVal = current[key]
      const risk = this.classifyRisk(key)

      if (!(key in baseline)) {
        changes.push({
          field,
          type: 'added',
          baseline: undefined,
          current: risk === 'high' ? '[MASKED]' : curVal,
          risk,
        })
      } else if (!(key in current)) {
        changes.push({
          field,
          type: 'removed',
          baseline: risk === 'high' ? '[MASKED]' : baseVal,
          current: undefined,
          risk,
        })
      } else if (
        baseVal !== null && curVal !== null &&
        typeof baseVal === 'object' && typeof curVal === 'object' &&
        !Array.isArray(baseVal) && !Array.isArray(curVal)
      ) {
        this.compareObjects(
          field,
          baseVal as Record<string, unknown>,
          curVal as Record<string, unknown>,
          changes,
        )
      } else if (!this.deepEqual(baseVal, curVal)) {
        changes.push({
          field,
          type: 'modified',
          baseline: risk === 'high' ? '[MASKED]' : baseVal,
          current: risk === 'high' ? '[MASKED]' : curVal,
          risk,
        })
      }
    }
  }

  private classifyRisk(key: string): DriftRisk {
    const lower = key.toLowerCase()
    if (HIGH_RISK_KEYS.some((k) => lower.includes(k))) return 'high'
    if (MEDIUM_RISK_KEYS.some((k) => lower.includes(k))) return 'medium'
    return 'low'
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (typeof a !== typeof b) return false
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      return a.every((v, i) => this.deepEqual(v, b[i]))
    }
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
      const ka = Object.keys(a as object).sort()
      const kb = Object.keys(b as object).sort()
      if (ka.join() !== kb.join()) return false
      return ka.every((k) => this.deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
    }
    return false
  }

  private deepCopy<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj)) as T
  }

  private audit(action: CDDAuditEntry['action'], configId: string, details: Record<string, unknown>): void {
    this.auditLog.push({ action, configId, timestamp: Date.now(), details })
  }
}
