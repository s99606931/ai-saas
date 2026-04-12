/**
 * Prompt Version Registry — SVC-AI-ADV-R161
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R161.design.md
 * Plan SC: FR-R161.1 ~ FR-R161.8
 *
 * 프롬프트 버전 레지스트리. 배포/롤백 중앙 관리와 변경 감사 기록.
 * A/B 테스트 + 회귀 대응을 위한 거버넌스 계층.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface PromptVersion {
  name: string
  version: string
  template: string
  author: string
  createdAt: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface RegistryOptions {
  now?: () => number
}

export class PromptVersionRegistry {
  private readonly versions: Map<string, PromptVersion[]> = new Map()
  private readonly active: Map<string, string> = new Map()
  private readonly previousActive: Map<string, string> = new Map()
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number

  constructor(opts: RegistryOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R161.1: 새 버전 등록 */
  register(
    name: string,
    version: string,
    template: string,
    author: string,
    grade: DataGrade = 'O',
  ): PromptVersion {
    this.assertGrade(grade)
    if (!name || !version || !template || !author) {
      throw new Error('invalid_input')
    }

    const list = this.versions.get(name) ?? []
    if (list.some((v) => v.version === version)) {
      throw new Error('duplicate_version')
    }

    const entry: PromptVersion = {
      name,
      version,
      template,
      author,
      createdAt: this.now(),
    }
    list.push(entry)
    this.versions.set(name, list)

    // 최초 등록 시 자동 활성화
    if (!this.active.has(name)) {
      this.active.set(name, version)
    }

    this.audit('registered', { name, version, author })
    return entry
  }

  /** FR-R161.3: 버전 활성화 */
  activate(name: string, version: string): void {
    const list = this.versions.get(name)
    if (!list || !list.some((v) => v.version === version)) {
      throw new Error('version_not_found')
    }
    const current = this.active.get(name)
    if (current && current !== version) {
      this.previousActive.set(name, current)
    }
    this.active.set(name, version)
    this.audit('activated', { name, version, previous: current ?? null })
  }

  /** FR-R161.5: 직전 active 버전으로 롤백 */
  rollback(name: string): string {
    const previous = this.previousActive.get(name)
    if (!previous) {
      throw new Error('no_previous_active')
    }
    const current = this.active.get(name)
    this.active.set(name, previous)
    if (current) {
      this.previousActive.set(name, current)
    }
    this.audit('rolledback', { name, to: previous, from: current ?? null })
    return previous
  }

  /** FR-R161.6: 현재 활성 프롬프트 조회 */
  getActive(name: string): PromptVersion | null {
    const activeVersion = this.active.get(name)
    if (!activeVersion) return null
    const list = this.versions.get(name) ?? []
    return list.find((v) => v.version === activeVersion) ?? null
  }

  /** FR-R161.7: 모든 버전 목록 */
  listVersions(name: string): PromptVersion[] {
    return [...(this.versions.get(name) ?? [])]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
