/**
 * Document Intelligence Pipeline — SVC-AI-ADV-R120
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R120.design.md
 * Plan SC: FR-R120.1 ~ FR-R120.8
 *
 * OCR → Classify → Extract → Structure end-to-end 문서 파이프라인.
 * CSAP D-06 감사, D-09 PII 마스킹, N2SF C/S 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface StageResult<T> {
  value: T
  confidence: number
  durationMs: number
}

export interface PipelineContext {
  grade: DataGrade
  intermediate: Record<string, unknown>
}

export interface Stage<I, O> {
  name: string
  run(input: I, ctx: PipelineContext): Promise<StageResult<O>>
}

export interface DocumentInput {
  id: string
  bytes?: Uint8Array
  text?: string
  grade: DataGrade
}

export interface DocumentPackage {
  id: string
  rawText: string
  category: string
  entities: Record<string, string>
  structured: Record<string, unknown>
  stageConfidences: Record<string, number>
  skipped: string[]
  totalDurationMs: number
}

export interface DIAuditEntry {
  timestamp: string
  action:
    | 'process'
    | 'stageStart'
    | 'stageSuccess'
    | 'stageFailure'
    | 'stageSkipped'
    | 'gradeBlocked'
    | 'piiMasked'
  detail?: Record<string, unknown>
}

export interface PipelineOptions {
  skipOnFailure?: boolean
  retries?: number
}

const PII_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  {
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    replacement: '[EMAIL]',
  },
  { pattern: /\b\d{6}[-]?\d{7}\b/g, replacement: '[RRN]' },
  { pattern: /\b01[0-9]-?\d{3,4}-?\d{4}\b/g, replacement: '[PHONE]' },
]

function maskPIIRecursive(value: unknown): { value: unknown; masked: number } {
  if (typeof value === 'string') {
    let v = value
    let masked = 0
    for (const { pattern, replacement } of PII_PATTERNS) {
      const m = v.match(pattern)
      if (m) {
        masked += m.length
        v = v.replace(pattern, replacement)
      }
    }
    return { value: v, masked }
  }
  if (Array.isArray(value)) {
    let masked = 0
    const arr = value.map((v) => {
      const r = maskPIIRecursive(v)
      masked += r.masked
      return r.value
    })
    return { value: arr, masked }
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    let masked = 0
    for (const [k, v] of Object.entries(value)) {
      const r = maskPIIRecursive(v)
      masked += r.masked
      out[k] = r.value
    }
    return { value: out, masked }
  }
  return { value, masked: 0 }
}

/**
 * 기본 OCR 스테이지: bytes → rawText. 외부 주입이 없으면 input.text 사용.
 */
export class DefaultOCRStage implements Stage<DocumentInput, string> {
  name = 'ocr'
  constructor(
    private readonly runner?: (bytes: Uint8Array) => Promise<string>,
  ) {}

  async run(
    input: DocumentInput,
  ): Promise<StageResult<string>> {
    const start = Date.now()
    let text = input.text ?? ''
    if (input.bytes && this.runner) {
      text = await this.runner(input.bytes)
    }
    return {
      value: text,
      confidence: text.length > 0 ? 0.9 : 0.1,
      durationMs: Date.now() - start,
    }
  }
}

/**
 * 기본 분류 스테이지: 키워드 기반 카테고리.
 */
export class DefaultClassifyStage implements Stage<string, string> {
  name = 'classify'
  private readonly rules: { category: string; keywords: string[] }[] = [
    { category: '민원신청', keywords: ['민원', '신청', '청원'] },
    { category: '증빙서류', keywords: ['증명', '증빙', '확인서'] },
    { category: '계약서', keywords: ['계약', '당사자', '합의'] },
    { category: '공문', keywords: ['수신', '발신', '문서번호'] },
  ]

  async run(text: string): Promise<StageResult<string>> {
    const start = Date.now()
    let bestCategory = '기타'
    let bestScore = 0
    for (const rule of this.rules) {
      const score = rule.keywords.reduce(
        (s, k) => s + (text.includes(k) ? 1 : 0),
        0,
      )
      if (score > bestScore) {
        bestScore = score
        bestCategory = rule.category
      }
    }
    return {
      value: bestCategory,
      confidence: bestScore === 0 ? 0.2 : Math.min(1, 0.5 + bestScore * 0.15),
      durationMs: Date.now() - start,
    }
  }
}

/**
 * 기본 엔티티 추출 스테이지.
 */
export class DefaultExtractStage
  implements Stage<string, Record<string, string>>
{
  name = 'extract'

  async run(
    text: string,
  ): Promise<StageResult<Record<string, string>>> {
    const start = Date.now()
    const entities: Record<string, string> = {}

    const date = text.match(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/)
    if (date) entities.date = date[0]

    const amount = text.match(/\d{1,3}(,\d{3})+\s*원|\d+\s*원/)
    if (amount) entities.amount = amount[0]

    const law = text.match(/[가-힣]+법(?:\s*제\s*\d+조)?/)
    if (law) entities.law = law[0]

    const name = text.match(/신청인[:\s]*([가-힣]{2,4})/)
    if (name && name[1]) entities.applicant = name[1]

    const count = Object.keys(entities).length
    return {
      value: entities,
      confidence: count === 0 ? 0.1 : Math.min(1, 0.3 + count * 0.2),
      durationMs: Date.now() - start,
    }
  }
}

/**
 * 기본 구조화 스테이지.
 */
export class DefaultStructureStage
  implements
    Stage<
      { text: string; category: string; entities: Record<string, string> },
      Record<string, unknown>
    >
{
  name = 'structure'

  async run(input: {
    text: string
    category: string
    entities: Record<string, string>
  }): Promise<StageResult<Record<string, unknown>>> {
    const start = Date.now()
    const structured: Record<string, unknown> = {
      category: input.category,
      entities: input.entities,
      summary: input.text.slice(0, 200),
      wordCount: input.text.split(/\s+/).filter(Boolean).length,
    }
    return {
      value: structured,
      confidence: 0.8,
      durationMs: Date.now() - start,
    }
  }
}

export class DocumentIntelligencePipeline {
  private readonly stages: Stage<unknown, unknown>[] = []
  private readonly skipOnFailure: boolean
  private readonly retries: number
  private readonly auditLog: DIAuditEntry[] = []

  constructor(options: PipelineOptions = {}) {
    this.skipOnFailure = options.skipOnFailure ?? true
    this.retries = options.retries ?? 1
  }

  addStage<I, O>(stage: Stage<I, O>): this {
    this.stages.push(stage as unknown as Stage<unknown, unknown>)
    return this
  }

  getAuditLog(): readonly DIAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: DIAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * 기본 스테이지 자동 등록.
   */
  useDefaults(): this {
    this.addStage(new DefaultOCRStage())
    this.addStage(new DefaultClassifyStage())
    this.addStage(new DefaultExtractStage())
    this.addStage(new DefaultStructureStage())
    return this
  }

  /**
   * FR-R120.3~7: 파이프라인 실행.
   */
  async process(input: DocumentInput): Promise<DocumentPackage> {
    // FR-R120.6: 등급 guard
    if (input.grade === DataGrade.C || input.grade === DataGrade.S) {
      this.audit('gradeBlocked', { grade: input.grade, id: input.id })
      throw new Error(
        `BLOCKED: ${input.grade}등급 문서는 AI 파이프라인 전송 금지 (N2SF N-05)`,
      )
    }

    this.audit('process', { id: input.id, stages: this.stages.length })

    const start = Date.now()
    const ctx: PipelineContext = { grade: input.grade, intermediate: {} }
    const stageConfidences: Record<string, number> = {}
    const skipped: string[] = []

    let rawText = input.text ?? ''
    let category = '기타'
    let entities: Record<string, string> = {}
    let structured: Record<string, unknown> = {}

    for (const stage of this.stages) {
      const stageInput = this.resolveInput(stage.name, input, {
        rawText,
        category,
        entities,
      })

      let success = false
      let lastError: unknown
      for (let attempt = 0; attempt <= this.retries && !success; attempt++) {
        try {
          this.audit('stageStart', { name: stage.name, attempt })
          const result = await stage.run(stageInput, ctx)
          stageConfidences[stage.name] = result.confidence
          this.applyResult(stage.name, result.value, {
            setRawText: (v) => (rawText = v),
            setCategory: (v) => (category = v),
            setEntities: (v) => (entities = v),
            setStructured: (v) => (structured = v),
          })
          ctx.intermediate[stage.name] = result.value
          this.audit('stageSuccess', {
            name: stage.name,
            confidence: result.confidence,
            durationMs: result.durationMs,
          })
          success = true
        } catch (err) {
          lastError = err
          this.audit('stageFailure', {
            name: stage.name,
            attempt,
            error: String(err),
          })
        }
      }

      if (!success) {
        if (this.skipOnFailure) {
          skipped.push(stage.name)
          this.audit('stageSkipped', { name: stage.name })
          continue
        }
        throw lastError instanceof Error
          ? lastError
          : new Error(`Stage ${stage.name} failed`)
      }
    }

    // FR-R120.7: PII 마스킹
    const maskResult = maskPIIRecursive(structured)
    if (maskResult.masked > 0) {
      this.audit('piiMasked', { count: maskResult.masked })
    }
    structured = maskResult.value as Record<string, unknown>

    const maskedEntities = maskPIIRecursive(entities).value as Record<
      string,
      string
    >

    return {
      id: input.id,
      rawText,
      category,
      entities: maskedEntities,
      structured,
      stageConfidences,
      skipped,
      totalDurationMs: Date.now() - start,
    }
  }

  private resolveInput(
    stageName: string,
    input: DocumentInput,
    state: {
      rawText: string
      category: string
      entities: Record<string, string>
    },
  ): unknown {
    switch (stageName) {
      case 'ocr':
        return input
      case 'classify':
        return state.rawText
      case 'extract':
        return state.rawText
      case 'structure':
        return {
          text: state.rawText,
          category: state.category,
          entities: state.entities,
        }
      default:
        return state
    }
  }

  private applyResult(
    stageName: string,
    value: unknown,
    setters: {
      setRawText: (v: string) => void
      setCategory: (v: string) => void
      setEntities: (v: Record<string, string>) => void
      setStructured: (v: Record<string, unknown>) => void
    },
  ): void {
    switch (stageName) {
      case 'ocr':
        if (typeof value === 'string') setters.setRawText(value)
        break
      case 'classify':
        if (typeof value === 'string') setters.setCategory(value)
        break
      case 'extract':
        if (value && typeof value === 'object') {
          setters.setEntities(value as Record<string, string>)
        }
        break
      case 'structure':
        if (value && typeof value === 'object') {
          setters.setStructured(value as Record<string, unknown>)
        }
        break
    }
  }
}
