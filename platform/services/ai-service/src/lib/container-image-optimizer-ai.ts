// Design Ref: §R351 — AI기반 자동 컨테이너 이미지 최적화
// Plan SC: SC-R351

export interface ContainerImage {
  imageId: string
  name: string
  tag: string
  baseImage: string
  sizeMb: number
  layers: number
  hasRootUser: boolean
  hasUnpinnedDeps: boolean
  hasSecurityVulns: boolean
  unusedPackages: string[]
}

export type OptimizationAction = 'REMOVE_UNUSED_PACKAGES' | 'SQUASH_LAYERS' | 'CHANGE_BASE_IMAGE' | 'REMOVE_ROOT_USER' | 'PIN_DEPENDENCIES'

export interface OptimizationRecommendation {
  action: OptimizationAction
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  estimatedSavingMb: number
  description: string
}

export interface ImageOptimizationPlan {
  imageId: string
  currentSizeMb: number
  estimatedOptimizedSizeMb: number
  recommendations: OptimizationRecommendation[]
  securityScore: number
  isProductionReady: boolean
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ContainerImageOptimizerAi {
  private images = new Map<string, ContainerImage>()
  private auditLog: AuditEntry[] = []

  registerImage(image: ContainerImage): void {
    this.images.set(image.imageId, image)
    this.auditLog.push({ action: 'image.register', timestamp: new Date().toISOString(), detail: image.imageId })
  }

  optimize(imageId: string): ImageOptimizationPlan {
    const image = this.images.get(imageId)
    if (!image) throw new Error(`Image not found: ${imageId}`)

    const recommendations: OptimizationRecommendation[] = []
    let totalSavingMb = 0

    if (image.hasRootUser) {
      recommendations.push({ action: 'REMOVE_ROOT_USER', priority: 'CRITICAL', estimatedSavingMb: 0, description: 'root 사용자 실행 보안 위험 — non-root 사용자로 전환 필수' })
    }

    if (image.hasSecurityVulns) {
      recommendations.push({ action: 'CHANGE_BASE_IMAGE', priority: 'CRITICAL', estimatedSavingMb: 0, description: '보안 취약점 포함 베이스 이미지 — distroless 또는 최신 이미지로 교체' })
    }

    if (image.unusedPackages.length > 0) {
      const saving = image.unusedPackages.length * 5
      totalSavingMb += saving
      recommendations.push({ action: 'REMOVE_UNUSED_PACKAGES', priority: 'HIGH', estimatedSavingMb: saving, description: `미사용 패키지 ${image.unusedPackages.length}개 제거 (${image.unusedPackages.join(', ')})` })
    }

    if (image.layers > 10) {
      const saving = Math.round((image.layers - 5) * 2)
      totalSavingMb += saving
      recommendations.push({ action: 'SQUASH_LAYERS', priority: 'MEDIUM', estimatedSavingMb: saving, description: `레이어 ${image.layers}개 → 멀티스테이지 빌드로 최적화` })
    }

    if (image.hasUnpinnedDeps) {
      recommendations.push({ action: 'PIN_DEPENDENCIES', priority: 'MEDIUM', estimatedSavingMb: 0, description: '미고정 의존성 — 재현성 보장을 위해 버전 고정 필수' })
    }

    // 보안 점수: 100에서 결함당 감점
    let securityScore = 100
    if (image.hasRootUser) securityScore -= 40
    if (image.hasSecurityVulns) securityScore -= 40
    if (image.hasUnpinnedDeps) securityScore -= 10
    securityScore = Math.max(0, securityScore)

    const isProductionReady = !image.hasRootUser && !image.hasSecurityVulns && securityScore >= 80

    this.auditLog.push({ action: 'image.optimize', timestamp: new Date().toISOString(), detail: `${imageId}:score=${securityScore}` })
    return {
      imageId,
      currentSizeMb: image.sizeMb,
      estimatedOptimizedSizeMb: Math.max(1, image.sizeMb - totalSavingMb),
      recommendations,
      securityScore,
      isProductionReady,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
