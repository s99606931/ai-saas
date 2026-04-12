/**
 * 컨테이너 보안 스캐너 AI — SVC-AI-ADV-R157
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R157/SVC-AI-ADV-R157.design.md
 * Plan SC: FR-R157.1 ~ FR-R157.5
 *
 * 컨테이너 이미지 CVE 분석 + CVSS 기반 우선순위 자동 결정 + 패치 권고.
 * CSAP D-08, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export type CveSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface CVEEntry {
  id: string
  cvss: number
  severity: CveSeverity
  affectedPackages: string[]
  description: string
  fixedVersion?: string
}

export interface ContainerImage {
  name: string
  tag: string
  packages: Array<{ name: string; version: string }>
}

export interface ScanFinding {
  cveId: string
  severity: CveSeverity
  cvss: number
  affectedPackage: string
  installedVersion: string
  fixedVersion?: string
  priority: number
}

export interface ScanReport {
  image: string
  scanAt: number
  findings: ScanFinding[]
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  patchRecommendations: Array<{ package: string; upgradeToVersion: string }>
}

export interface ScannerAuditEntry {
  action: 'cveRegistered' | 'scanned'
  timestamp: number
  details: Record<string, unknown>
}

export class ContainerSecurityScannerAI {
  private readonly cves = new Map<string, CVEEntry>()
  private readonly auditLog: ScannerAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 컨테이너 보안 스캐너 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R157.1 */
  registerCVE(entry: CVEEntry): void {
    if (!entry.id.trim()) throw new Error('CVE id must not be empty')
    if (entry.cvss < 0 || entry.cvss > 10) throw new Error('CVSS must be 0~10')
    this.cves.set(entry.id, { ...entry })
    this.audit('cveRegistered', { id: entry.id, cvss: entry.cvss, severity: entry.severity })
  }

  /** FR-R157.2 ~ FR-R157.4 */
  scan(image: ContainerImage): ScanReport {
    const imagePackageNames = new Set(image.packages.map((p) => p.name.toLowerCase()))
    const packageVersionMap = new Map(image.packages.map((p) => [p.name.toLowerCase(), p.version]))

    const findings: ScanFinding[] = []

    for (const cve of this.cves.values()) {
      for (const affected of cve.affectedPackages) {
        if (imagePackageNames.has(affected.toLowerCase())) {
          const priority = this.calcPriority(cve.severity, cve.cvss)
          findings.push({
            cveId: cve.id,
            severity: cve.severity,
            cvss: cve.cvss,
            affectedPackage: affected,
            installedVersion: packageVersionMap.get(affected.toLowerCase()) ?? 'unknown',
            fixedVersion: cve.fixedVersion,
            priority,
          })
        }
      }
    }

    findings.sort((a, b) => b.priority - a.priority)

    // 패치 권고 — 패키지당 최고 priority CVE 기준
    const patchMap = new Map<string, string>()
    for (const f of findings) {
      if (f.fixedVersion && !patchMap.has(f.affectedPackage)) {
        patchMap.set(f.affectedPackage, f.fixedVersion)
      }
    }

    const report: ScanReport = {
      image: `${image.name}:${image.tag}`,
      scanAt: Date.now(),
      findings,
      criticalCount: findings.filter((f) => f.severity === 'critical').length,
      highCount: findings.filter((f) => f.severity === 'high').length,
      mediumCount: findings.filter((f) => f.severity === 'medium').length,
      lowCount: findings.filter((f) => f.severity === 'low').length,
      patchRecommendations: [...patchMap.entries()].map(([pkg, ver]) => ({
        package: pkg,
        upgradeToVersion: ver,
      })),
    }

    this.audit('scanned', {
      image: report.image,
      findings: findings.length,
      critical: report.criticalCount,
    })

    return report
  }

  /** FR-R157.5 */
  getAuditLog(): readonly ScannerAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private calcPriority(severity: CveSeverity, cvss: number): number {
    const base = severity === 'critical' ? 10 : severity === 'high' ? 8 : severity === 'medium' ? 5 : 2
    return Math.min(10, base + cvss * 0.1)
  }

  private audit(action: ScannerAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
