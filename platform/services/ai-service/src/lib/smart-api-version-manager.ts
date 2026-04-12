// Design Ref: §핵심 알고리즘 — 버전 파싱, 호환성 분석, 업그레이드 경로
// Plan SC: SVC-AI-ADV-R310
export type DataGrade = 'O' | 'C' | 'S'
export type ApiStatus = 'active' | 'deprecated' | 'retired'
export type CompatibilityType = 'incompatible' | 'backward-compatible' | 'patch-compatible'

export interface SemVer {
  major: number
  minor: number
  patch: number
}

export interface ApiVersion {
  id: string
  apiName: string
  version: string
  semver: SemVer
  status: ApiStatus
  usageCount: number
}

export interface CompatibilityResult {
  fromVersionId: string
  toVersionId: string
  compatibility: CompatibilityType
  breaking: boolean
  warning?: string
}

export interface UpgradeRecommendation {
  fromVersionId: string
  toVersionId: string
  toVersion: string
  compatibility: CompatibilityType
  warning?: string
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function parseSemver(version: string): SemVer {
  const parts = version.split('.')
  if (parts.length !== 3) throw new Error(`잘못된 semver 형식: ${version}`)
  const nums = parts.map(Number)
  const major = nums[0] ?? 0
  const minor = nums[1] ?? 0
  const patch = nums[2] ?? 0
  if (isNaN(major) || isNaN(minor) || isNaN(patch)) throw new Error(`잘못된 semver 형식: ${version}`)
  return { major, minor, patch }
}

export class SmartApiVersionManager {
  private versions = new Map<string, ApiVersion>()
  private auditLog: AuditEntry[] = []

  registerVersion(id: string, apiName: string, version: string, status: ApiStatus): void {
    if (!id || !apiName || !version) throw new Error('id, apiName, version은 필수')
    const semver = parseSemver(version)
    this.versions.set(id, { id, apiName, version, semver, status, usageCount: 0 })
    this.auditLog.push({ action: 'version.register', timestamp: new Date().toISOString(), detail: `${apiName}@${version}` })
  }

  recordUsage(versionId: string, count: number, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 사용량 데이터 기록 금지 (N2SF N-05)`)
    }
    const ver = this.versions.get(versionId)
    if (!ver) throw new Error(`versionId 없음: ${versionId}`)
    ver.usageCount += count
    this.auditLog.push({ action: 'usage.record', timestamp: new Date().toISOString(), detail: `${versionId}:+${count}` })
  }

  analyzeCompatibility(fromVersionId: string, toVersionId: string): CompatibilityResult {
    const from = this.versions.get(fromVersionId)
    const to = this.versions.get(toVersionId)
    if (!from) throw new Error(`fromVersionId 없음: ${fromVersionId}`)
    if (!to) throw new Error(`toVersionId 없음: ${toVersionId}`)
    let compatibility: CompatibilityType
    let breaking = false
    let warning: string | undefined
    if (from.semver.major !== to.semver.major) {
      compatibility = 'incompatible'
      breaking = true
      warning = `major 버전 변경 (${from.semver.major} → ${to.semver.major}): 하위 호환성 미보장`
    } else if (from.semver.minor !== to.semver.minor) {
      compatibility = 'backward-compatible'
    } else {
      compatibility = 'patch-compatible'
    }
    return { fromVersionId, toVersionId, compatibility, breaking, warning }
  }

  getUpgradePath(versionId: string): UpgradeRecommendation[] {
    const current = this.versions.get(versionId)
    if (!current) throw new Error(`versionId 없음: ${versionId}`)
    const recommendations: UpgradeRecommendation[] = []
    for (const ver of this.versions.values()) {
      if (ver.id === versionId) continue
      if (ver.apiName !== current.apiName) continue
      if (ver.status !== 'active') continue
      const isNewer =
        ver.semver.major > current.semver.major ||
        (ver.semver.major === current.semver.major && ver.semver.minor > current.semver.minor) ||
        (ver.semver.major === current.semver.major &&
          ver.semver.minor === current.semver.minor &&
          ver.semver.patch > current.semver.patch)
      if (!isNewer) continue
      const result = this.analyzeCompatibility(versionId, ver.id)
      recommendations.push({
        fromVersionId: versionId,
        toVersionId: ver.id,
        toVersion: ver.version,
        compatibility: result.compatibility,
        warning: result.warning,
      })
    }
    return recommendations.sort((a, b) => {
      const va = this.versions.get(a.toVersionId)!.semver
      const vb = this.versions.get(b.toVersionId)!.semver
      if (va.major !== vb.major) return va.major - vb.major
      if (va.minor !== vb.minor) return va.minor - vb.minor
      return va.patch - vb.patch
    })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
