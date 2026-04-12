/**
 * API Deprecation Manager — SVC-AI-ADV-R103
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R103.design.md
 * Plan SC: FR-R103.1 ~ FR-R103.5
 *
 * API 버전 생애주기 관리 + IETF Deprecation draft 헤더 자동 주입.
 */

export type VersionStatus = 'ACTIVE' | 'DEPRECATED' | 'SUNSET'

export interface ApiVersion {
  apiId: string
  version: string
  status: VersionStatus
  sunsetDate?: string
  successor?: string
  registeredAt: string
}

export interface VersionCheck {
  allowed: boolean
  status: VersionStatus | 'UNKNOWN'
  message: string
  headers: Record<string, string>
}

export class ApiDeprecationManager {
  private readonly versions = new Map<string, ApiVersion>()

  private key(apiId: string, version: string): string {
    return `${apiId}:${version}`
  }

  /**
   * FR-R103.1: 버전 등록.
   */
  registerVersion(v: Omit<ApiVersion, 'registeredAt'>): ApiVersion {
    const full: ApiVersion = {
      ...v,
      registeredAt: new Date().toISOString(),
    }
    this.versions.set(this.key(full.apiId, full.version), full)
    return full
  }

  /**
   * FR-R103.2: 상태 변경.
   */
  updateStatus(
    apiId: string,
    version: string,
    status: VersionStatus,
    sunsetDate?: string,
  ): void {
    const existing = this.versions.get(this.key(apiId, version))
    if (!existing) throw new Error(`version not found: ${apiId}@${version}`)
    existing.status = status
    if (sunsetDate !== undefined) existing.sunsetDate = sunsetDate
  }

  /**
   * FR-R103.3, FR-R103.4: 버전 확인 + 헤더 생성.
   */
  checkVersion(apiId: string, version: string): VersionCheck {
    const v = this.versions.get(this.key(apiId, version))
    if (!v) {
      return {
        allowed: false,
        status: 'UNKNOWN',
        message: `Unknown API version: ${apiId}@${version}`,
        headers: {},
      }
    }
    const headers: Record<string, string> = {}
    switch (v.status) {
      case 'ACTIVE':
        return {
          allowed: true,
          status: 'ACTIVE',
          message: 'OK',
          headers,
        }
      case 'DEPRECATED':
        headers.Deprecation = 'true'
        if (v.sunsetDate) headers.Sunset = v.sunsetDate
        if (v.successor) {
          headers.Link = `<${v.successor}>; rel="successor-version"`
        }
        return {
          allowed: true,
          status: 'DEPRECATED',
          message: `${apiId}@${version} is deprecated`,
          headers,
        }
      case 'SUNSET':
        return {
          allowed: false,
          status: 'SUNSET',
          message: `${apiId}@${version} has been sunset`,
          headers,
        }
    }
  }

  /**
   * FR-R103.5: 30일 이내 단종 예정 리스트.
   */
  upcomingSunsets(withinDays: number, now: Date = new Date()): ApiVersion[] {
    const cutoff = now.getTime() + withinDays * 24 * 60 * 60 * 1000
    const out: ApiVersion[] = []
    for (const v of this.versions.values()) {
      if (!v.sunsetDate) continue
      const ts = Date.parse(v.sunsetDate)
      if (Number.isFinite(ts) && ts >= now.getTime() && ts <= cutoff) {
        out.push(v)
      }
    }
    return out.sort(
      (a, b) => Date.parse(a.sunsetDate!) - Date.parse(b.sunsetDate!),
    )
  }
}
