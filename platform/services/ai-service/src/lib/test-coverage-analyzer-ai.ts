// Design Ref: §R252 — AI기반 테스트 커버리지 분석
// Plan SC: SVC-AI-ADV-R252-SC01
// CSAP D-06: 감사 로그, D-12: 입력 검증

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type CoverageStatus = 'EXCELLENT' | 'GOOD' | 'INSUFFICIENT' | 'CRITICAL'

export interface ModuleProfile {
  moduleId: string
  name: string
  totalLines: number
  businessCritical: boolean
}

export interface CoverageReport {
  moduleId: string
  coveredLines: number
  totalLines: number
  branchCoverage: number  // 0~1
  mutationScore: number   // 0~1
  measuredAt: string
}

export interface CoverageAnalysis {
  moduleId: string
  lineCoverage: number  // 0~1
  branchCoverage: number
  mutationScore: number
  status: CoverageStatus
  riskLevel: RiskLevel
  gaps: string[]
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  moduleId: string
  detail: Record<string, unknown>
}

export class TestCoverageAnalyzerAi {
  private modules = new Map<string, ModuleProfile>()
  private reports = new Map<string, CoverageReport[]>()
  private auditLog: AuditEntry[] = []

  registerModule(profile: ModuleProfile): void {
    this.modules.set(profile.moduleId, profile)
    this.reports.set(profile.moduleId, [])
    this.appendAudit('module.register', profile.moduleId, { name: profile.name, businessCritical: profile.businessCritical })
  }

  recordCoverage(report: CoverageReport): void {
    if (!this.modules.has(report.moduleId)) throw new Error(`Unknown module: ${report.moduleId}`)
    if (report.coveredLines > report.totalLines) throw new Error('coveredLines는 totalLines를 초과할 수 없습니다')
    const list = this.reports.get(report.moduleId) ?? []
    list.push(report)
    this.reports.set(report.moduleId, list)
  }

  analyze(moduleId: string): CoverageAnalysis {
    const module = this.modules.get(moduleId)
    if (!module) throw new Error(`Unknown module: ${moduleId}`)

    const history = this.reports.get(moduleId) ?? []
    const gaps: string[] = []

    let lineCoverage = 0
    let branchCoverage = 0
    let mutationScore = 0

    if (history.length > 0) {
      const latest = history[history.length - 1]!
      lineCoverage = latest.coveredLines / latest.totalLines
      branchCoverage = latest.branchCoverage
      mutationScore = latest.mutationScore
    }

    // 갭 분석
    const threshold = module.businessCritical ? 0.9 : 0.8
    if (lineCoverage < threshold) {
      gaps.push(`라인 커버리지 ${Math.round(lineCoverage * 100)}% — 목표 ${Math.round(threshold * 100)}% 미달`)
    }
    if (branchCoverage < 0.75) {
      gaps.push(`브랜치 커버리지 ${Math.round(branchCoverage * 100)}% — 75% 미달`)
    }
    if (module.businessCritical && mutationScore < 0.7) {
      gaps.push(`뮤테이션 점수 ${Math.round(mutationScore * 100)}% — 중요 모듈 70% 미달`)
    }

    // 상태 판정
    let status: CoverageStatus
    let riskLevel: RiskLevel
    if (lineCoverage >= 0.9 && branchCoverage >= 0.85) {
      status = 'EXCELLENT'; riskLevel = 'LOW'
    } else if (lineCoverage >= 0.8 && branchCoverage >= 0.75) {
      status = 'GOOD'; riskLevel = 'LOW'
    } else if (lineCoverage >= 0.6) {
      status = 'INSUFFICIENT'; riskLevel = module.businessCritical ? 'HIGH' : 'MEDIUM'
    } else {
      status = 'CRITICAL'; riskLevel = 'CRITICAL'
    }

    const recommendation =
      status === 'CRITICAL' ? '즉시 테스트 추가 필요 — 배포 차단 권고' :
      status === 'INSUFFICIENT' ? '테스트 보강 후 배포 검토' :
      gaps.length > 0 ? '브랜치/뮤테이션 테스트 보완 권고' :
      '현재 커버리지 수준 유지'

    this.appendAudit('coverage.analyze', moduleId, { status, riskLevel, lineCoverage: Math.round(lineCoverage * 100) / 100 })

    return { moduleId, lineCoverage: Math.round(lineCoverage * 100) / 100, branchCoverage: Math.round(branchCoverage * 100) / 100, mutationScore: Math.round(mutationScore * 100) / 100, status, riskLevel, gaps, recommendation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, moduleId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, moduleId, detail })
  }
}
