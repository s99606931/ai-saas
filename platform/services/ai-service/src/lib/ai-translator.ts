// SVC-AI-ADV-R40: AI 번역 엔진 오케스트레이터
// Design Ref: §모듈, §데이터 흐름
// Plan SC: FR-R40.1, FR-R40.4
//
// 한↔영/일/중 번역을 로컬 NLLB 모델 + 도메인 용어집으로 수행한다.
// C/S 등급 데이터 전송은 완전 차단.

import { TerminologyManager, type Lang, createTerminologyManager, seedAdminTerminology } from './terminology-manager'
import { TranslationEvaluator, type QualityReport } from './translation-evaluator'

export type Grade = 'O' | 'C' | 'S'

export interface TranslateInput {
  text: string
  source: Lang
  target: Lang
  grade: Grade
  domain?: string
  reference?: string  // 품질 평가 참조 (있으면 자동 평가)
}

export interface TranslationResult {
  text: string
  source: Lang
  target: Lang
  domain: string
  termsApplied: number
  latencyMs: number
  quality?: QualityReport
}

type AuditSink = (event: Record<string, unknown>) => Promise<void> | void

/**
 * AI 번역 엔진.
 * C/S 등급 데이터는 절대 외부 모델로 전송하지 않는다.
 */
export class AITranslator {
  private readonly terminology: TerminologyManager
  private readonly evaluator: TranslationEvaluator
  private readonly modelEndpoint: string
  private readonly auditSink?: AuditSink

  constructor(options: {
    terminology?: TerminologyManager
    evaluator?: TranslationEvaluator
    modelEndpoint?: string
    auditSink?: AuditSink
    seed?: boolean
  } = {}) {
    this.terminology = options.terminology ?? createTerminologyManager()
    this.evaluator = options.evaluator ?? new TranslationEvaluator()
    this.modelEndpoint = options.modelEndpoint ?? process.env.NLLB_LOCAL_ENDPOINT ?? 'http://host.docker.internal:9102/nllb'
    this.auditSink = options.auditSink

    if (options.seed !== false) {
      seedAdminTerminology(this.terminology)
    }
  }

  /**
   * 번역 실행.
   * @throws grade가 C/S인 경우 즉시 차단 (N2SF N-05)
   */
  async translate(input: TranslateInput): Promise<TranslationResult> {
    this.enforceGrade(input.grade)
    this.enforceLocalEndpoint()
    if (!input.text || input.text.trim().length === 0) {
      throw new Error('translation input empty')
    }
    if (input.source === input.target) {
      throw new Error('source and target language must differ')
    }

    const domain = input.domain ?? 'administration'
    const start = Date.now()

    // 1) 용어집 전처리
    const { text: preprocessed, placeholders } = this.terminology.preprocess(
      input.text,
      domain,
      input.source,
      input.target,
    )

    // 2) 로컬 NLLB 호출
    const translated = await this.invokeLocalModel(preprocessed, input.source, input.target)

    // 3) 용어집 후처리 (플레이스홀더 복원)
    const finalText = this.terminology.postprocess(translated, placeholders)

    // 4) 품질 평가 (참조가 있을 때만)
    const quality = input.reference ? this.evaluator.evaluate(finalText, input.reference) : undefined

    // 5) 감사 로그
    if (this.auditSink) {
      await this.auditSink({
        ts: new Date().toISOString(),
        action: 'TRANSLATE',
        source: input.source,
        target: input.target,
        domain,
        grade: input.grade,
        inputLen: input.text.length,
        outputLen: finalText.length,
        termsApplied: placeholders.size,
        bleu: quality?.bleu,
      })
    }

    return {
      text: finalText,
      source: input.source,
      target: input.target,
      domain,
      termsApplied: placeholders.size,
      latencyMs: Date.now() - start,
      quality,
    }
  }

  /**
   * 용어집 매니저 접근자 (외부에서 용어 추가 시).
   */
  getTerminology(): TerminologyManager {
    return this.terminology
  }

  private enforceGrade(grade: Grade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터 번역 금지 (N2SF N-05)`)
    }
  }

  private enforceLocalEndpoint(): void {
    const local = ['localhost', '127.0.0.1', 'host.docker.internal', '::1']
    try {
      const u = new URL(this.modelEndpoint)
      if (!local.includes(u.hostname) && !u.hostname.endsWith('.local')) {
        throw new Error('BLOCKED: 번역 모델은 로컬 엔드포인트만 허용 (N2SF)')
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('BLOCKED')) throw e
      throw new Error('invalid translation model endpoint')
    }
  }

  private async invokeLocalModel(text: string, source: Lang, target: Lang): Promise<string> {
    // NOTE: 스텁 구현. Phase 2에서 NLLB-200 ONNX runtime 연결 예정.
    return `[${source}>${target}] ${text}`
  }
}

export function createAITranslator(options?: ConstructorParameters<typeof AITranslator>[0]): AITranslator {
  return new AITranslator(options)
}
