// SVC-AI-ADV-R48: AutoML 기반 API 병목 분석 및 최적화 제안
// Design Ref: §API 병목 분석, §인터페이스
// Plan SC: FR-R48.3

import { QueryPlanAnalyzer, type IndexRecommendation } from './query-plan-analyzer'

export interface APIMetric {
  endpoint: string
  method: string
  p50: number
  p95: number
  p99: number
  callsPerMinute: number
  errorRate: number          // 0~1
  avgDbQueryMs?: number
  avgExternalCallMs?: number
}

export interface Bottleneck {
  endpoint: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'latency' | 'error' | 'frequency' | 'db' | 'external'
  impactScore: number        // 호출수 × 평균 latency
  evidence: string
}

export interface BottleneckReport {
  totalEndpoints: number
  bottlenecks: Bottleneck[]
  overallHealthScore: number  // 0~100
  generatedAt: Date
}

export type SuggestionKind =
  | 'add-cache'
  | 'add-index'
  | 'batch-request'
  | 'async-process'
  | 'scale-out'
  | 'rate-limit'
  | 'circuit-breaker'

export interface Suggestion {
  endpoint: string
  kind: SuggestionKind
  reason: string
  estimatedImpactPct: number
  implementation: string
  priority: 'P0' | 'P1' | 'P2'
}

/**
 * AutoML 기반 성능 최적화 제안기.
 * API 메트릭을 분석하여 병목 구간 식별 + 개선 제안.
 */
export class AutoMLOptimizer {
  private readonly planAnalyzer: QueryPlanAnalyzer
  private readonly p95Threshold: number
  private readonly errorThreshold: number

  constructor(options: {
    planAnalyzer?: QueryPlanAnalyzer
    p95Threshold?: number
    errorThreshold?: number
  } = {}) {
    this.planAnalyzer = options.planAnalyzer ?? new QueryPlanAnalyzer()
    this.p95Threshold = options.p95Threshold ?? 500
    this.errorThreshold = options.errorThreshold ?? 0.01
  }

  /**
   * API 메트릭 분석.
   */
  analyzeAPIMetrics(metrics: APIMetric[]): BottleneckReport {
    if (!Array.isArray(metrics)) {
      throw new Error('metrics must be an array')
    }

    const bottlenecks: Bottleneck[] = []
    let healthPenalty = 0

    for (const m of metrics) {
      const impactScore = m.callsPerMinute * m.p95

      // Latency bottleneck
      if (m.p95 > this.p95Threshold) {
        const severity: Bottleneck['severity'] =
          m.p95 > this.p95Threshold * 4
            ? 'critical'
            : m.p95 > this.p95Threshold * 2
              ? 'high'
              : 'medium'
        bottlenecks.push({
          endpoint: `${m.method} ${m.endpoint}`,
          severity,
          category: 'latency',
          impactScore,
          evidence: `P95=${m.p95}ms (threshold=${this.p95Threshold}ms)`,
        })
        healthPenalty += severity === 'critical' ? 20 : severity === 'high' ? 10 : 5
      }

      // Error rate bottleneck
      if (m.errorRate > this.errorThreshold) {
        const severity: Bottleneck['severity'] =
          m.errorRate > 0.05 ? 'critical' : m.errorRate > 0.02 ? 'high' : 'medium'
        bottlenecks.push({
          endpoint: `${m.method} ${m.endpoint}`,
          severity,
          category: 'error',
          impactScore,
          evidence: `error rate=${(m.errorRate * 100).toFixed(2)}%`,
        })
        healthPenalty += severity === 'critical' ? 15 : 8
      }

      // DB bottleneck
      if (m.avgDbQueryMs !== undefined && m.avgDbQueryMs > m.p95 * 0.5) {
        bottlenecks.push({
          endpoint: `${m.method} ${m.endpoint}`,
          severity: 'high',
          category: 'db',
          impactScore,
          evidence: `DB 쿼리가 P95의 ${((m.avgDbQueryMs / m.p95) * 100).toFixed(0)}% 점유`,
        })
        healthPenalty += 10
      }

      // External call bottleneck
      if (m.avgExternalCallMs !== undefined && m.avgExternalCallMs > m.p95 * 0.4) {
        bottlenecks.push({
          endpoint: `${m.method} ${m.endpoint}`,
          severity: 'medium',
          category: 'external',
          impactScore,
          evidence: `외부 호출이 P95의 ${((m.avgExternalCallMs / m.p95) * 100).toFixed(0)}% 점유`,
        })
        healthPenalty += 5
      }

      // High frequency warning
      if (m.callsPerMinute > 1000) {
        bottlenecks.push({
          endpoint: `${m.method} ${m.endpoint}`,
          severity: 'low',
          category: 'frequency',
          impactScore,
          evidence: `${m.callsPerMinute} calls/min`,
        })
      }
    }

    // 영향도 상위 순 정렬
    bottlenecks.sort((a, b) => b.impactScore - a.impactScore)

    return {
      totalEndpoints: metrics.length,
      bottlenecks,
      overallHealthScore: Math.max(0, 100 - healthPenalty),
      generatedAt: new Date(),
    }
  }

  /**
   * 리포트로부터 구체 제안 생성.
   */
  suggest(report: BottleneckReport): Suggestion[] {
    const suggestions: Suggestion[] = []
    const seen = new Set<string>()

    for (const b of report.bottlenecks) {
      const key = `${b.endpoint}|${b.category}`
      if (seen.has(key)) continue
      seen.add(key)

      switch (b.category) {
        case 'latency':
          suggestions.push({
            endpoint: b.endpoint,
            kind: 'add-cache',
            reason: `P95 초과 (${b.evidence}) — 응답 캐싱으로 개선 가능`,
            estimatedImpactPct: b.severity === 'critical' ? 50 : 30,
            implementation: '응답 페이로드 Redis 캐싱 (TTL 60s). Cache-Control 헤더 설정.',
            priority: b.severity === 'critical' ? 'P0' : 'P1',
          })
          break
        case 'db':
          suggestions.push({
            endpoint: b.endpoint,
            kind: 'add-index',
            reason: `DB 쿼리 병목 (${b.evidence}) — 인덱스 추가 권장`,
            estimatedImpactPct: 40,
            implementation: 'EXPLAIN 분석 후 QueryPlanAnalyzer.recommendIndexes 실행',
            priority: 'P0',
          })
          break
        case 'external':
          suggestions.push({
            endpoint: b.endpoint,
            kind: 'async-process',
            reason: `외부 호출 병목 (${b.evidence}) — 비동기화 권장`,
            estimatedImpactPct: 35,
            implementation: '메시지 큐로 비동기 처리 + 폴링/Webhook',
            priority: 'P1',
          })
          suggestions.push({
            endpoint: b.endpoint,
            kind: 'circuit-breaker',
            reason: '외부 서비스 장애 전파 방지',
            estimatedImpactPct: 20,
            implementation: 'Circuit Breaker 패턴 (실패 5회/10초 → 30초 OPEN)',
            priority: 'P1',
          })
          break
        case 'error':
          suggestions.push({
            endpoint: b.endpoint,
            kind: 'circuit-breaker',
            reason: `에러율 높음 (${b.evidence})`,
            estimatedImpactPct: 25,
            implementation: '에러 로그 분석 + 재시도 + 서킷 브레이커',
            priority: 'P0',
          })
          break
        case 'frequency':
          suggestions.push({
            endpoint: b.endpoint,
            kind: 'rate-limit',
            reason: `호출 빈도 높음 (${b.evidence})`,
            estimatedImpactPct: 15,
            implementation: '토큰 버킷 기반 레이트 리미팅',
            priority: 'P2',
          })
          suggestions.push({
            endpoint: b.endpoint,
            kind: 'batch-request',
            reason: '반복 호출 배치화 가능성 검토',
            estimatedImpactPct: 30,
            implementation: '클라이언트 배치 API 제공',
            priority: 'P2',
          })
          break
      }
    }

    return suggestions
  }

  /**
   * SQL 쿼리 기반 인덱스 추천 (wrapper).
   */
  recommendIndexesForSlowQuery(explainOutput: string, query: string): IndexRecommendation[] {
    const plan = this.planAnalyzer.parse(explainOutput)
    const result = this.planAnalyzer.analyze(plan, query)
    return this.planAnalyzer.recommendIndexes(result, query)
  }
}

export function createAutoMLOptimizer(): AutoMLOptimizer {
  return new AutoMLOptimizer()
}
