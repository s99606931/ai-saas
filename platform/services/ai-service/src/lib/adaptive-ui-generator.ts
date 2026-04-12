/**
 * Adaptive UI Generator — SVC-AI-ADV-R139
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R139.design.md
 * Plan SC: FR-R139.1 ~ FR-R139.6
 *
 * 사용자 행동(click/dwell/scroll) 기반 공공기관 포털 UI 자동 적응.
 * WCAG 2.1 AA 필수 컴포넌트 숨김 금지. N2SF O등급 행동 메트릭만 사용.
 */

export type DataGrade = 'O' | 'C' | 'S'
export type BehaviorEventType = 'click' | 'dwell' | 'scroll'

export interface BehaviorEvent {
  componentId: string
  type: BehaviorEventType
  value: number
  ts: number
}

export interface ComponentSpec {
  id: string
  required?: boolean
  defaultOrder: number
}

export interface UiComponentOutput {
  id: string
  visible: boolean
  order: number
  score: number
}

export interface UiLayoutSpec {
  components: UiComponentOutput[]
  generatedAt: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface GeneratorOptions {
  now?: () => number
  hideThreshold?: number
}

export class AdaptiveUiGenerator {
  private readonly scores = new Map<string, number>()
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number
  private readonly hideThreshold: number

  constructor(opts: GeneratorOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
    this.hideThreshold = opts.hideThreshold ?? 0.5
  }

  /**
   * 행동 이벤트 수집 및 점수 누적.
   * FR-R139.1, FR-R139.2
   */
  ingest(events: BehaviorEvent[], grade: DataGrade = 'O'): void {
    this.assertDataGrade(grade)
    for (const ev of events) {
      const weight = this.weightFor(ev)
      const prev = this.scores.get(ev.componentId) ?? 0
      this.scores.set(ev.componentId, prev + weight)
    }
    this.auditLog.push({
      event: 'ui.events.ingested',
      detail: { count: events.length },
      at: this.now(),
    })
  }

  /**
   * UI 스펙 생성.
   * FR-R139.3, FR-R139.4
   */
  generate(components: ComponentSpec[], grade: DataGrade = 'O'): UiLayoutSpec {
    this.assertDataGrade(grade)

    const scored = components.map((c) => ({
      id: c.id,
      required: c.required === true,
      defaultOrder: c.defaultOrder,
      score: this.scores.get(c.id) ?? 0,
    }))

    // 점수 내림차순 정렬. 동점이면 defaultOrder
    const sorted = [...scored].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }
      return a.defaultOrder - b.defaultOrder
    })

    const output: UiComponentOutput[] = sorted.map((c, idx) => ({
      id: c.id,
      visible: c.required || c.score >= this.hideThreshold,
      order: idx,
      score: c.score,
    }))

    const spec: UiLayoutSpec = {
      components: output,
      generatedAt: this.now(),
    }

    this.auditLog.push({
      event: 'ui.layout.generated',
      detail: { componentCount: output.length },
      at: this.now(),
    })

    return spec
  }

  /**
   * 컴포넌트별 관심도 점수 조회.
   * FR-R139.2
   */
  computeScore(componentId: string): number {
    return this.scores.get(componentId) ?? 0
  }

  /**
   * 감사 로그 조회.
   * FR-R139.5
   */
  getAuditLog(): ReadonlyArray<AuditEntry> {
    return [...this.auditLog]
  }

  private weightFor(ev: BehaviorEvent): number {
    switch (ev.type) {
      case 'click':
        return 3 * Math.max(0, ev.value)
      case 'dwell':
        return 0.1 * Math.max(0, ev.value)
      case 'scroll':
        return 0.5 * Math.max(0, ev.value)
      default:
        return 0
    }
  }

  private assertDataGrade(grade: DataGrade): void {
    if (grade !== 'O') {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 Adaptive UI Generator 전송 금지 (N2SF N-05)`,
      )
    }
  }
}
