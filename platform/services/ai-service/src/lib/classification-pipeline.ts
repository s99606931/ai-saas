// SVC-AI-ADV-R46: 문서 분류 배치 파이프라인
// Design Ref: §모듈, §흐름
// Plan SC: FR-R46.3

import { DocumentClassifier, type ClassificationResult } from './document-classifier'

export interface PipelineInput {
  id: string
  title: string
  content: string
  receivedAt?: Date
}

export interface PipelineOutput {
  id: string
  result: ClassificationResult
  escalatedTo?: 'human-review-queue'
  processedAt: Date
}

export interface PipelineStats {
  total: number
  classified: number
  escalated: number
  failed: number
  byGrade: Record<string, number>
  byType: Record<string, number>
  avgConfidence: number
}

type ReviewQueueSink = (item: PipelineInput, result: ClassificationResult) => Promise<void> | void

/**
 * 문서 분류 배치 파이프라인.
 * 입력 큐를 처리하고 저신뢰 항목을 에스컬레이션한다.
 */
export class ClassificationPipeline {
  private readonly classifier: DocumentClassifier
  private readonly reviewSink?: ReviewQueueSink
  private readonly stats: PipelineStats = {
    total: 0,
    classified: 0,
    escalated: 0,
    failed: 0,
    byGrade: {},
    byType: {},
    avgConfidence: 0,
  }

  constructor(options: {
    classifier?: DocumentClassifier
    reviewSink?: ReviewQueueSink
  } = {}) {
    this.classifier = options.classifier ?? new DocumentClassifier()
    this.reviewSink = options.reviewSink
  }

  /**
   * 배치 실행.
   */
  async run(inputs: PipelineInput[]): Promise<PipelineOutput[]> {
    if (!Array.isArray(inputs)) {
      throw new Error('inputs must be an array')
    }
    const outputs: PipelineOutput[] = []
    let confidenceSum = 0

    for (const input of inputs) {
      this.stats.total += 1
      try {
        const result = this.classifier.classify(input.content, input.title)
        this.stats.classified += 1
        confidenceSum += result.overallConfidence

        // 통계 업데이트
        const grade = result.securityGrade.label
        const type = result.docType.label
        this.stats.byGrade[grade] = (this.stats.byGrade[grade] ?? 0) + 1
        this.stats.byType[type] = (this.stats.byType[type] ?? 0) + 1

        let escalatedTo: 'human-review-queue' | undefined
        if (result.needsHumanReview) {
          this.stats.escalated += 1
          escalatedTo = 'human-review-queue'
          if (this.reviewSink) {
            await this.reviewSink(input, result)
          }
        }

        outputs.push({
          id: input.id,
          result,
          escalatedTo,
          processedAt: new Date(),
        })
      } catch (error) {
        this.stats.failed += 1
        // 실패한 항목은 기본 결과로 에스컬레이션
        const errMessage = error instanceof Error ? error.message : String(error)
        outputs.push({
          id: input.id,
          result: {
            securityGrade: { label: 'O', confidence: 0, reasons: [`분류 실패: ${errMessage}`] },
            department: { label: '기타', confidence: 0, reasons: [] },
            docType: { label: '기타', confidence: 0, reasons: [] },
            urgency: { label: '일반', confidence: 0, reasons: [] },
            needsHumanReview: true,
            overallConfidence: 0,
            classifiedAt: new Date(),
          },
          escalatedTo: 'human-review-queue',
          processedAt: new Date(),
        })
      }
    }

    this.stats.avgConfidence =
      this.stats.classified === 0 ? 0 : confidenceSum / this.stats.classified

    return outputs
  }

  /**
   * 현재 통계 스냅샷.
   */
  getStats(): PipelineStats {
    return { ...this.stats, byGrade: { ...this.stats.byGrade }, byType: { ...this.stats.byType } }
  }

  /**
   * 통계 초기화.
   */
  resetStats(): void {
    this.stats.total = 0
    this.stats.classified = 0
    this.stats.escalated = 0
    this.stats.failed = 0
    this.stats.byGrade = {}
    this.stats.byType = {}
    this.stats.avgConfidence = 0
  }
}

export function createClassificationPipeline(
  options?: ConstructorParameters<typeof ClassificationPipeline>[0],
): ClassificationPipeline {
  return new ClassificationPipeline(options)
}
