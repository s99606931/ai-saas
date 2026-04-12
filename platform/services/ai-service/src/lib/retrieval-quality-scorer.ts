/**
 * Retrieval Quality Scorer — SVC-AI-ADV-R113
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R113.design.md
 * Plan SC: FR-R113.1 ~ FR-R113.7
 *
 * RAG 검색 결과의 정확도/다양성/신선도를 채점하여 품질 게이트 제공.
 * CSAP D-06 감사, N2SF C/S 등급 차단, 하드코딩 시크릿 없음.
 */

import { createHash } from 'crypto'

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface RetrievalResult {
  id: string
  content: string
  embedding: number[]
  timestamp: number
  score?: number
}

export interface QualityWeights {
  accuracy: number
  diversity: number
  freshness: number
}

export interface QualityBreakdown {
  accuracy: number
  diversity: number
  freshness: number
}

export interface QualityReport {
  score: number
  breakdown: QualityBreakdown
  passed: boolean
  threshold: number
  resultCount: number
  queryHash: string
}

export interface ScorerOptions {
  weights?: QualityWeights
  threshold?: number
  freshnessHalfLifeMs?: number
  grade?: DataGrade
}

export interface QualityAuditEntry {
  timestamp: string
  action: 'score' | 'gradeBlocked' | 'emptyInput'
  queryHash?: string
  score?: number
  passed?: boolean
  grade: DataGrade
}

const DEFAULT_WEIGHTS: QualityWeights = {
  accuracy: 0.5,
  diversity: 0.3,
  freshness: 0.2,
}

const DEFAULT_THRESHOLD = 0.6
const DEFAULT_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000

function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    dot += av * bv
    na += av * av
    nb += bv * bv
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function hashQuery(query: string): string {
  return createHash('sha256').update(query).digest('hex').slice(0, 16)
}

export class RetrievalQualityScorer {
  private readonly weights: QualityWeights
  private readonly threshold: number
  private readonly halfLife: number
  private readonly grade: DataGrade
  private readonly auditLog: QualityAuditEntry[] = []

  constructor(options: ScorerOptions = {}) {
    const grade = options.grade ?? DataGrade.O
    if (grade === DataGrade.C || grade === DataGrade.S) {
      this.audit({
        timestamp: new Date().toISOString(),
        action: 'gradeBlocked',
        grade,
      })
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`,
      )
    }
    this.grade = grade
    this.weights = options.weights ?? DEFAULT_WEIGHTS
    this.threshold = options.threshold ?? DEFAULT_THRESHOLD
    this.halfLife = options.freshnessHalfLifeMs ?? DEFAULT_HALF_LIFE_MS
    this.validateWeights()
  }

  getAuditLog(): readonly QualityAuditEntry[] {
    return this.auditLog
  }

  private audit(entry: QualityAuditEntry): void {
    this.auditLog.push(entry)
  }

  private validateWeights(): void {
    const sum =
      this.weights.accuracy + this.weights.diversity + this.weights.freshness
    if (Math.abs(sum - 1) > 0.001) {
      throw new Error(`QualityWeights must sum to 1 (got ${sum})`)
    }
  }

  /**
   * FR-R113.1: 정확도 점수.
   */
  accuracyScore(
    queryEmbedding: number[],
    results: RetrievalResult[],
  ): number {
    if (results.length === 0) return 0
    let sum = 0
    for (const r of results) {
      sum += clamp01(cosine(queryEmbedding, r.embedding))
    }
    return sum / results.length
  }

  /**
   * FR-R113.2: 다양성 점수 (1 - 평균 중복도).
   */
  diversityScore(results: RetrievalResult[]): number {
    if (results.length < 2) return 1
    let sum = 0
    let pairs = 0
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const ri = results[i]
        const rj = results[j]
        if (!ri || !rj) continue
        sum += clamp01(cosine(ri.embedding, rj.embedding))
        pairs++
      }
    }
    if (pairs === 0) return 1
    return clamp01(1 - sum / pairs)
  }

  /**
   * FR-R113.3: 신선도 점수.
   */
  freshnessScore(results: RetrievalResult[], now: number = Date.now()): number {
    if (results.length === 0) return 0
    let sum = 0
    for (const r of results) {
      const age = Math.max(0, now - r.timestamp)
      sum += Math.exp(-age / this.halfLife)
    }
    return clamp01(sum / results.length)
  }

  /**
   * FR-R113.4, FR-R113.5: 통합 점수 + 임계값 게이트.
   */
  score(
    query: string,
    queryEmbedding: number[],
    results: RetrievalResult[],
    now: number = Date.now(),
  ): QualityReport {
    const queryHash = hashQuery(query)

    if (results.length === 0) {
      const report: QualityReport = {
        score: 0,
        breakdown: { accuracy: 0, diversity: 0, freshness: 0 },
        passed: false,
        threshold: this.threshold,
        resultCount: 0,
        queryHash,
      }
      this.audit({
        timestamp: new Date().toISOString(),
        action: 'emptyInput',
        queryHash,
        score: 0,
        passed: false,
        grade: this.grade,
      })
      return report
    }

    const accuracy = this.accuracyScore(queryEmbedding, results)
    const diversity = this.diversityScore(results)
    const freshness = this.freshnessScore(results, now)
    const combined =
      accuracy * this.weights.accuracy +
      diversity * this.weights.diversity +
      freshness * this.weights.freshness

    const report: QualityReport = {
      score: clamp01(combined),
      breakdown: { accuracy, diversity, freshness },
      passed: combined >= this.threshold,
      threshold: this.threshold,
      resultCount: results.length,
      queryHash,
    }

    this.audit({
      timestamp: new Date().toISOString(),
      action: 'score',
      queryHash,
      score: report.score,
      passed: report.passed,
      grade: this.grade,
    })

    return report
  }
}
