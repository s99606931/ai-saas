/**
 * Semantic Version Control for Prompts — SVC-AI-ADV-R107
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R107.design.md
 * Plan SC: FR-R107.1 ~ FR-R107.5
 *
 * 프롬프트 SemVer 관리 + 라인 diff + 롤백.
 * 기존 prompt-versioning.ts(순번+A/B)와 별도 모듈.
 * CSAP D-06 감사, 하드코딩 시크릿 차단.
 */

export type BumpType = 'major' | 'minor' | 'patch'

export interface SemVer {
  major: number
  minor: number
  patch: number
}

export interface PromptCommit {
  name: string
  version: SemVer
  versionString: string
  template: string
  message?: string
  committedAt: string
  isActive: boolean
  activationOrder?: number
}

export interface DiffLine {
  type: ' ' | '+' | '-'
  line: string
}

export interface PromptSemVerAuditEntry {
  timestamp: string
  action:
    | 'commit'
    | 'setActive'
    | 'rollback'
    | 'diff'
    | 'secretBlocked'
  detail?: Record<string, unknown>
}

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{36}/,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
]

function versionString(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}`
}

export class PromptSemanticVersionControl {
  private readonly historyByName = new Map<string, PromptCommit[]>()
  private readonly auditLog: PromptSemVerAuditEntry[] = []
  private activationSeq = 0

  getAuditLog(): readonly PromptSemVerAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: PromptSemVerAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R107.1: 프롬프트 커밋 (SemVer 증가).
   */
  commit(
    name: string,
    template: string,
    bumpType: BumpType = 'patch',
    message?: string,
  ): PromptCommit {
    this.assertNoSecrets(name, template)
    const history = this.getOrCreateHistory(name)
    const last = history[history.length - 1]
    const newVer = last
      ? this.bump(last.version, bumpType)
      : { major: 1, minor: 0, patch: 0 }
    for (const c of history) c.isActive = false
    const commit: PromptCommit = {
      name,
      version: newVer,
      versionString: versionString(newVer),
      template,
      ...(message !== undefined ? { message } : {}),
      committedAt: new Date().toISOString(),
      isActive: true,
      activationOrder: ++this.activationSeq,
    }
    history.push(commit)
    this.audit('commit', {
      name,
      version: commit.versionString,
      bumpType,
    })
    return commit
  }

  /**
   * FR-R107.2: 활성 버전 조회.
   */
  getActive(name: string): PromptCommit | null {
    const history = this.historyByName.get(name) ?? []
    return history.find((c) => c.isActive) ?? null
  }

  /**
   * FR-R107.2: 특정 버전 활성화.
   */
  setActive(name: string, ver: string): PromptCommit {
    const history = this.historyByName.get(name) ?? []
    const target = history.find((c) => c.versionString === ver)
    if (!target) throw new Error(`version not found: ${name}@${ver}`)
    for (const c of history) c.isActive = false
    target.isActive = true
    target.activationOrder = ++this.activationSeq
    this.audit('setActive', { name, version: ver })
    return target
  }

  /**
   * FR-R107.3: 두 버전 간 라인 단위 diff.
   */
  diff(name: string, verA: string, verB: string): DiffLine[] {
    const history = this.historyByName.get(name) ?? []
    const a = history.find((c) => c.versionString === verA)
    const b = history.find((c) => c.versionString === verB)
    if (!a || !b) {
      throw new Error(`version not found for diff: ${verA} or ${verB}`)
    }
    const result = this.computeDiff(a.template, b.template)
    this.audit('diff', { name, from: verA, to: verB, lines: result.length })
    return result
  }

  /**
   * FR-R107.4: 이전 활성 버전으로 롤백.
   */
  rollback(name: string): PromptCommit | null {
    const history = this.historyByName.get(name) ?? []
    const current = history.find((c) => c.isActive)
    if (!current) return null
    const prev = history
      .filter(
        (c) =>
          c.versionString !== current.versionString &&
          c.activationOrder !== undefined,
      )
      .sort((x, y) => (y.activationOrder ?? 0) - (x.activationOrder ?? 0))
    if (prev.length === 0) return null
    current.isActive = false
    const next = prev[0]!
    next.isActive = true
    next.activationOrder = ++this.activationSeq
    this.audit('rollback', {
      name,
      from: current.versionString,
      to: next.versionString,
    })
    return next
  }

  /**
   * FR-R107.5: 전체 버전 히스토리.
   */
  history(name: string): PromptCommit[] {
    return [...(this.historyByName.get(name) ?? [])]
  }

  private getOrCreateHistory(name: string): PromptCommit[] {
    let list = this.historyByName.get(name)
    if (!list) {
      list = []
      this.historyByName.set(name, list)
    }
    return list
  }

  private bump(v: SemVer, type: BumpType): SemVer {
    switch (type) {
      case 'major':
        return { major: v.major + 1, minor: 0, patch: 0 }
      case 'minor':
        return { major: v.major, minor: v.minor + 1, patch: 0 }
      case 'patch':
        return { major: v.major, minor: v.minor, patch: v.patch + 1 }
    }
  }

  private assertNoSecrets(name: string, template: string): void {
    for (const pat of SECRET_PATTERNS) {
      if (pat.test(template)) {
        this.audit('secretBlocked', { name })
        throw new Error(
          `BLOCKED: 하드코딩 시크릿 의심 패턴 감지 (CSAP D-12) — ${pat.source}`,
        )
      }
    }
  }

  /**
   * 라인 단위 diff: 공통 프리픽스/서픽스 스킵 + 중간 영역 -/+ 나열.
   */
  private computeDiff(a: string, b: string): DiffLine[] {
    const linesA = a.split('\n')
    const linesB = b.split('\n')
    let start = 0
    while (
      start < linesA.length &&
      start < linesB.length &&
      linesA[start] === linesB[start]
    ) {
      start++
    }
    let endA = linesA.length
    let endB = linesB.length
    while (
      endA > start &&
      endB > start &&
      linesA[endA - 1] === linesB[endB - 1]
    ) {
      endA--
      endB--
    }
    const result: DiffLine[] = []
    for (let i = 0; i < start; i++) {
      result.push({ type: ' ', line: linesA[i]! })
    }
    for (let i = start; i < endA; i++) {
      result.push({ type: '-', line: linesA[i]! })
    }
    for (let i = start; i < endB; i++) {
      result.push({ type: '+', line: linesB[i]! })
    }
    for (let i = endA; i < linesA.length; i++) {
      result.push({ type: ' ', line: linesA[i]! })
    }
    return result
  }
}
