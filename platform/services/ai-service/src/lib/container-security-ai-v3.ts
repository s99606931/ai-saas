/**
 * Container Security AI V3 — SVC-AI-ADV-R657 (트랙 A 24차)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R657.design.md
 * Plan SC: FR-R657.1 ~ FR-R657.6
 *
 * 컨테이너 이미지 CVE + 런타임 syscall 이상행위 통합 분석.
 * N2SF N-05: C/S 등급 차단.
 */

export type DataGrade = 'C' | 'S' | 'O'
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type RecommendedAction = 'BLOCK' | 'QUARANTINE' | 'MONITOR' | 'ALLOW'

export interface CVE {
  cveId: string
  cvss: number
}

export interface ImageRecord {
  imageId: string
  layers: string[]
  vulnerabilities: CVE[]
  grade: DataGrade
  registeredAt: string
}

export interface RuntimeAnomaly {
  imageId: string
  syscall: string
  processName: string
  timestamp: string
}

export interface AnalysisResult {
  imageId: string
  cvssMax: number
  anomalyCount: number
  riskScore: number
  riskLevel: RiskLevel
  action: RecommendedAction
}

export interface Stats {
  totalImages: number
  byLevel: Record<RiskLevel, number>
}

export interface AuditEntry {
  timestamp: string
  action: string
  imageId: string
  detail: Record<string, unknown>
}

const DANGEROUS_SYSCALLS = new Set(['ptrace', 'kexec_load', 'mount', 'init_module'])

export class ContainerSecurityAIV3 {
  private readonly images = new Map<string, ImageRecord>()
  private readonly anomalies = new Map<string, RuntimeAnomaly[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R657.1
  registerImage(
    imageId: string,
    layers: string[],
    vulnerabilities: CVE[],
    grade: DataGrade = 'O',
  ): ImageRecord {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (this.images.has(imageId)) {
      throw new Error(`Image already registered: ${imageId}`)
    }
    const record: ImageRecord = {
      imageId,
      layers: [...layers],
      vulnerabilities: vulnerabilities.map((v) => ({ ...v })),
      grade,
      registeredAt: new Date().toISOString(),
    }
    this.images.set(imageId, record)
    this.anomalies.set(imageId, [])
    this.appendAudit('image.register', imageId, { cveCount: vulnerabilities.length })
    return { ...record, layers: [...record.layers], vulnerabilities: record.vulnerabilities.map((v) => ({ ...v })) }
  }

  // Plan SC: FR-R657.2
  reportAnomaly(imageId: string, syscall: string, processName: string): RuntimeAnomaly {
    this.requireImage(imageId)
    const anomaly: RuntimeAnomaly = {
      imageId,
      syscall,
      processName,
      timestamp: new Date().toISOString(),
    }
    this.anomalies.get(imageId)!.push(anomaly)
    this.appendAudit('anomaly.report', imageId, { syscall, processName })
    return { ...anomaly }
  }

  // Plan SC: FR-R657.3 + FR-R657.4
  analyze(imageId: string): AnalysisResult {
    const image = this.requireImage(imageId)
    const anomalies = this.anomalies.get(imageId)!
    const cvssMax = image.vulnerabilities.reduce((m, v) => Math.max(m, v.cvss), 0)
    const dangerousCount = anomalies.filter((a) => DANGEROUS_SYSCALLS.has(a.syscall)).length
    const riskScore = cvssMax + dangerousCount * 1.5
    const riskLevel: RiskLevel =
      riskScore >= 9 ? 'CRITICAL' : riskScore >= 7 ? 'HIGH' : riskScore >= 4 ? 'MEDIUM' : 'LOW'
    const action: RecommendedAction =
      riskLevel === 'CRITICAL'
        ? 'BLOCK'
        : riskLevel === 'HIGH'
          ? 'QUARANTINE'
          : riskLevel === 'MEDIUM'
            ? 'MONITOR'
            : 'ALLOW'
    return { imageId, cvssMax, anomalyCount: anomalies.length, riskScore, riskLevel, action }
  }

  // Plan SC: FR-R657.5
  getStats(): Stats {
    const byLevel: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    for (const imageId of this.images.keys()) {
      const result = this.analyze(imageId)
      byLevel[result.riskLevel] += 1
    }
    return { totalImages: this.images.size, byLevel }
  }

  // Plan SC: FR-R657.6 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private requireImage(imageId: string): ImageRecord {
    const image = this.images.get(imageId)
    if (!image) throw new Error(`Unknown image: ${imageId}`)
    return image
  }

  private appendAudit(action: string, imageId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, imageId, detail })
  }
}
