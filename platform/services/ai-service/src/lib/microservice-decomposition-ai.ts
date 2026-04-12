// Design Ref: §R250 — AI기반 마이크로서비스 자동 분할
// Plan SC: SVC-AI-ADV-R250-SC01
// CSAP D-12: 입력 검증, D-06: 감사 로그

export type CouplingType = 'TIGHT' | 'MODERATE' | 'LOOSE'
export type DecompositionStrategy = 'BY_DOMAIN' | 'BY_TEAM' | 'BY_SCALABILITY' | 'NO_CHANGE'

export interface ServiceComponent {
  componentId: string
  name: string
  domain: string
  linesOfCode: number
  dependencies: string[]  // 다른 componentId 목록
}

export interface DecompositionPlan {
  componentId: string
  strategy: DecompositionStrategy
  couplingLevel: CouplingType
  suggestedServices: string[]
  reason: string
  complexityScore: number  // 0~100
}

interface AuditEntry {
  timestamp: string
  action: string
  componentId: string
  detail: Record<string, unknown>
}

function computeCoupling(component: ServiceComponent, all: Map<string, ServiceComponent>): CouplingType {
  const depCount = component.dependencies.length
  // 역방향 의존 수
  let inboundCount = 0
  for (const [id, c] of all) {
    if (id !== component.componentId && c.dependencies.includes(component.componentId)) inboundCount++
  }
  const total = depCount + inboundCount
  if (total >= 6) return 'TIGHT'
  if (total >= 3) return 'MODERATE'
  return 'LOOSE'
}

export class MicroserviceDecompositionAi {
  private components = new Map<string, ServiceComponent>()
  private auditLog: AuditEntry[] = []

  registerComponent(component: ServiceComponent): void {
    this.components.set(component.componentId, component)
    this.appendAudit('component.register', component.componentId, { name: component.name, domain: component.domain })
  }

  analyze(componentId: string): DecompositionPlan {
    const component = this.components.get(componentId)
    if (!component) throw new Error(`Unknown component: ${componentId}`)

    const coupling = computeCoupling(component, this.components)

    // 복잡도 점수: 코드 크기 + 의존 수 + 인바운드 수
    const depCount = component.dependencies.length
    let inboundCount = 0
    for (const [id, c] of this.components) {
      if (id !== componentId && c.dependencies.includes(componentId)) inboundCount++
    }
    const complexityScore = Math.min(100, Math.round(
      (component.linesOfCode / 50) + depCount * 5 + inboundCount * 5
    ))

    let strategy: DecompositionStrategy = 'NO_CHANGE'
    let suggestedServices: string[] = []
    let reason = '현재 구조 유지 권장'

    if (coupling === 'TIGHT' || component.linesOfCode > 2000) {
      strategy = 'BY_DOMAIN'
      suggestedServices = [`${component.name}-core`, `${component.name}-api`, `${component.name}-worker`]
      reason = `높은 결합도(${coupling}) 또는 대용량 컴포넌트 — 도메인별 분할 권고`
    } else if (coupling === 'MODERATE' && component.linesOfCode > 1000) {
      strategy = 'BY_SCALABILITY'
      suggestedServices = [`${component.name}-read`, `${component.name}-write`]
      reason = `중간 결합도 + 코드량 — 읽기/쓰기 분리 권고`
    } else if (depCount === 0 && inboundCount >= 3) {
      strategy = 'BY_TEAM'
      suggestedServices = [`${component.name}-shared`]
      reason = '다수 팀 공유 컴포넌트 — 독립 팀 서비스 분리 권고'
    }

    this.appendAudit('component.analyze', componentId, { strategy, coupling, complexityScore })

    return { componentId, strategy, couplingLevel: coupling, suggestedServices, reason, complexityScore }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, componentId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, componentId, detail })
  }
}
