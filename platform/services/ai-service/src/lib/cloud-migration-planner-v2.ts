// Design Ref: §클래스 설계 — CloudMigrationPlannerV2
// Plan SC: SVC-AI-ADV-R474

import { createHash } from 'crypto'

type TechStack = 'legacy' | 'modern' | 'cloud-native'
type MigrationStrategy = 'refactor' | 'replatform' | 'rehost'

const TECH_STACK_SCORE: Record<TechStack, number> = {
  legacy: 30,
  modern: 15,
  'cloud-native': 5,
}

interface MigrationSystem {
  systemId: string
  name: string
  techStack: TechStack
  dependencyCount: number
}

interface AuditEntry {
  timestamp: string
  action: string
  systemId: string
  maskedSystemId?: string
  details?: Record<string, unknown>
}

export class CloudMigrationPlannerV2 {
  private systems = new Map<string, MigrationSystem>()
  private auditLog: AuditEntry[] = []

  registerSystem(systemId: string, name: string, techStack: TechStack): MigrationSystem {
    const system: MigrationSystem = { systemId, name, techStack, dependencyCount: 0 }
    this.systems.set(systemId, system)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_SYSTEM',
      systemId,
      details: { name, techStack },
    })
    return system
  }

  addDependencies(systemId: string, dependencyCount: number, dataGrade?: string): void {
    // N2SF N-05: C/S 등급 데이터 AI API 전송 금지
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }

    const system = this.systems.get(systemId)
    if (!system) {
      throw new Error(`시스템을 찾을 수 없습니다: ${systemId}`)
    }

    system.dependencyCount += dependencyCount
    const maskedSystemId = createHash('sha256').update(systemId).digest('hex').substring(0, 16)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ADD_DEPENDENCIES',
      systemId,
      maskedSystemId,
      details: { dependencyCount, totalDependencies: system.dependencyCount },
    })
  }

  getComplexityScore(systemId: string): number {
    const system = this.systems.get(systemId)
    if (!system) {
      throw new Error(`시스템을 찾을 수 없습니다: ${systemId}`)
    }
    const techScore = TECH_STACK_SCORE[system.techStack]
    return Math.min(100, system.dependencyCount * 10 + techScore)
  }

  getMigrationStrategy(systemId: string): MigrationStrategy {
    const score = this.getComplexityScore(systemId)
    if (score >= 70) return 'refactor'
    if (score >= 40) return 'replatform'
    return 'rehost'
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
