// Design Ref: §R417 — AI기반 자동 컨테이너 보안 스캐닝 v2
// Plan SC: SC-R417

export interface ContainerImage {
  imageId: string
  imageName: string
  tag: string
  runAsRoot: boolean
  layers: number
}

export interface ImageCve {
  cveId: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  packageName: string
  fixAvailable: boolean
}

export type DeploymentDecision = 'BLOCK' | 'WARNING' | 'PASS'

export interface ScanReport {
  imageId: string
  imageName: string
  securityScore: number
  deploymentDecision: DeploymentDecision
  criticalCount: number
  highCount: number
  totalCveCount: number
  cves: ImageCve[]
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

const CVE_SCORES: Record<ImageCve['severity'], number> = {
  CRITICAL: 40,
  HIGH: 20,
  MEDIUM: 10,
  LOW: 5,
}

export class ContainerSecurityScannerV2 {
  private images = new Map<string, ContainerImage>()
  private imageCves = new Map<string, ImageCve[]>()
  private auditLog: AuditEntry[] = []

  registerImage(image: ContainerImage): void {
    this.images.set(image.imageId, image)
    this.imageCves.set(image.imageId, [])
    this.auditLog.push({ action: 'image.register', timestamp: new Date().toISOString(), detail: `${image.imageId}(${image.imageName}:${image.tag})` })
  }

  addCve(imageId: string, cve: ImageCve): void {
    if (!this.imageCves.has(imageId)) this.imageCves.set(imageId, [])
    this.imageCves.get(imageId)!.push(cve)
  }

  scan(imageId: string): ScanReport {
    const image = this.images.get(imageId)
    if (!image) throw new Error(`Image not found: ${imageId}`)

    const cves = this.imageCves.get(imageId) ?? []
    const criticalCount = cves.filter((c) => c.severity === 'CRITICAL').length
    const highCount = cves.filter((c) => c.severity === 'HIGH').length

    const cveDeduction = cves.reduce((s, c) => s + CVE_SCORES[c.severity], 0)
    const rootDeduction = image.runAsRoot ? 20 : 0
    const securityScore = Math.max(0, 100 - cveDeduction - rootDeduction)

    let deploymentDecision: DeploymentDecision
    if (criticalCount > 0 || image.runAsRoot) {
      deploymentDecision = 'BLOCK'
    } else if (highCount >= 2) {
      deploymentDecision = 'WARNING'
    } else {
      deploymentDecision = 'PASS'
    }

    const recommendations: string[] = []
    if (criticalCount > 0) recommendations.push(`CRITICAL CVE ${criticalCount}개 — 즉시 패키지 업데이트 후 재빌드`)
    if (image.runAsRoot) recommendations.push('루트 실행 금지 — non-root 사용자로 전환 (보안 정책 위반)')
    if (highCount > 0) recommendations.push(`HIGH CVE ${highCount}개 — 수정 버전 업데이트 권고`)
    const fixableCount = cves.filter((c) => c.fixAvailable).length
    if (fixableCount > 0) recommendations.push(`자동 수정 가능 CVE ${fixableCount}개 — 패키지 업데이트 즉시 적용`)

    this.auditLog.push({ action: 'image.scan', timestamp: new Date().toISOString(), detail: `${imageId}:${deploymentDecision}` })
    return { imageId, imageName: image.imageName, securityScore, deploymentDecision, criticalCount, highCount, totalCveCount: cves.length, cves, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
