/**
 * Model Card Generator — SVC-AI-ADV-R157
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R157.design.md
 * Plan SC: FR-R157.1 ~ FR-R157.8
 *
 * AI 모델 투명성 문서(모델 카드)를 표준 템플릿으로 생성한다.
 * EU AI Act Art.13, 행안부 공공 AI 투명성 요건 대응.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface ModelCardChangelogEntry {
  version: string
  date: string
  note: string
}

export interface ModelCardMeta {
  name: string
  version: string
  purpose: string
  owner: string
  trainingData: string
  evaluation: string
  limitations: string
  ethicalConsiderations: string
  changelog?: ModelCardChangelogEntry[]
}

export interface ModelCardOutput {
  markdown: string
  json: Record<string, unknown>
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface GeneratorOptions {
  now?: () => number
}

const REQUIRED_FIELDS: Array<keyof ModelCardMeta> = [
  'name',
  'version',
  'purpose',
  'owner',
  'trainingData',
  'evaluation',
  'limitations',
  'ethicalConsiderations',
]

const REQUIRED_SECTIONS = [
  '## 1. 개요',
  '## 2. 목적',
  '## 3. 학습 데이터',
  '## 4. 평가 지표',
  '## 5. 한계',
  '## 6. 윤리적 고려사항',
  '## 7. 소유자',
  '## 8. 변경 이력',
]

export class ModelCardGenerator {
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number

  constructor(opts: GeneratorOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R157.1~FR-R157.5: 모델 카드 빌드 */
  build(meta: ModelCardMeta, grade: DataGrade = 'O'): ModelCardOutput {
    this.assertGrade(grade)
    this.validateRequired(meta)
    this.validateVersion(meta.version)

    const markdown = this.renderMarkdown(meta)
    const json: Record<string, unknown> = {
      name: meta.name,
      version: meta.version,
      purpose: meta.purpose,
      owner: meta.owner,
      trainingData: meta.trainingData,
      evaluation: meta.evaluation,
      limitations: meta.limitations,
      ethicalConsiderations: meta.ethicalConsiderations,
      changelog: meta.changelog ?? [],
      generatedAt: new Date(this.now()).toISOString(),
    }

    const output: ModelCardOutput = { markdown, json }
    this.audit('built', { name: meta.name, version: meta.version })
    return output
  }

  /** FR-R157.6: 체크리스트 검증 */
  validateChecklist(output: ModelCardOutput): boolean {
    return REQUIRED_SECTIONS.every((section) => output.markdown.includes(section))
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private validateRequired(meta: ModelCardMeta): void {
    for (const field of REQUIRED_FIELDS) {
      const value = meta[field]
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`missing_field:${String(field)}`)
      }
    }
  }

  private validateVersion(version: string): void {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error('invalid_version')
    }
  }

  private renderMarkdown(meta: ModelCardMeta): string {
    const changelogLines =
      meta.changelog && meta.changelog.length > 0
        ? meta.changelog
            .map((c) => `- **v${c.version}** (${c.date}): ${c.note}`)
            .join('\n')
        : '- 최초 작성'

    return [
      `# 모델 카드 — ${meta.name} v${meta.version}`,
      '',
      '## 1. 개요',
      `모델명: ${meta.name}`,
      `버전: ${meta.version}`,
      '',
      '## 2. 목적',
      meta.purpose,
      '',
      '## 3. 학습 데이터',
      meta.trainingData,
      '',
      '## 4. 평가 지표',
      meta.evaluation,
      '',
      '## 5. 한계',
      meta.limitations,
      '',
      '## 6. 윤리적 고려사항',
      meta.ethicalConsiderations,
      '',
      '## 7. 소유자',
      meta.owner,
      '',
      '## 8. 변경 이력',
      changelogLines,
      '',
    ].join('\n')
  }

  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
