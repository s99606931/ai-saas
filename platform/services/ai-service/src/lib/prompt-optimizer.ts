// SVC-AI-ADV-R42: 프롬프트 자동 최적화 엔진
// Design Ref: §흐름, §인터페이스
// Plan SC: FR-R42.1, FR-R42.3

import { DSPyCompiler, type Example, type PromptCandidate } from './dspy-compiler'

export interface Metrics {
  accuracy: number     // 0~1
  costUSD: number      // 토큰 비용
  latencyMs: number    // 평균 응답 시간
}

export interface CandidateResult {
  candidate: PromptCandidate
  metrics: Metrics
  paretoRank: number
}

export interface OptimizationResult {
  best: CandidateResult
  pareto: CandidateResult[]
  all: CandidateResult[]
  improvementPct: { accuracy: number; cost: number; latency: number }
}

export interface OptimizeOptions {
  signature: string
  maxIterations?: number
  weightAccuracy?: number
  weightCost?: number
  weightLatency?: number
}

type Executor = (prompt: string, input: string) => Promise<{ output: string; tokens: number; latencyMs: number }>
type Scorer = (predicted: string, expected: string) => number  // 0~1

/**
 * 프롬프트 자동 최적화 엔진.
 * DSPyCompiler가 생성한 후보를 메트릭 기반으로 평가, 파레토 최적 선택.
 */
export class PromptOptimizer {
  private readonly compiler: DSPyCompiler
  private readonly executor: Executor
  private readonly scorer: Scorer
  private readonly costPerKToken: number

  constructor(options: {
    compiler?: DSPyCompiler
    executor: Executor
    scorer: Scorer
    costPerKToken?: number
  }) {
    this.compiler = options.compiler ?? new DSPyCompiler()
    this.executor = options.executor
    this.scorer = options.scorer
    this.costPerKToken = options.costPerKToken ?? 0.0015
  }

  /**
   * 최적화 실행.
   */
  async optimize(initial: string, dataset: Example[], opts: OptimizeOptions): Promise<OptimizationResult> {
    if (dataset.length === 0) throw new Error('dataset required')

    const candidates = this.compiler.compile(opts.signature, dataset)
    // 초기 프롬프트도 비교 대상에 포함
    candidates.unshift({
      id: 'cand-initial',
      text: initial,
      fewShots: [],
      strategy: 'baseline',
    })

    const results: CandidateResult[] = []
    for (const c of candidates) {
      const m = await this.evaluate(c, dataset)
      results.push({ candidate: c, metrics: m, paretoRank: 0 })
    }

    // 파레토 랭킹
    this.assignParetoRank(results)
    const pareto = results.filter((r) => r.paretoRank === 1)

    // 가중치 기반 최종 선택
    const wAcc = opts.weightAccuracy ?? 0.5
    const wCost = opts.weightCost ?? 0.3
    const wLat = opts.weightLatency ?? 0.2

    const best = results.reduce((acc, cur) => {
      const accScore = this.compositeScore(acc.metrics, wAcc, wCost, wLat)
      const curScore = this.compositeScore(cur.metrics, wAcc, wCost, wLat)
      return curScore > accScore ? cur : acc
    })

    const initialResult = results[0]
    if (!initialResult) throw new Error('initial evaluation failed')

    const improvementPct = {
      accuracy: this.percentDelta(initialResult.metrics.accuracy, best.metrics.accuracy),
      cost: -this.percentDelta(initialResult.metrics.costUSD, best.metrics.costUSD),
      latency: -this.percentDelta(initialResult.metrics.latencyMs, best.metrics.latencyMs),
    }

    return { best, pareto, all: results, improvementPct }
  }

  private async evaluate(candidate: PromptCandidate, dataset: Example[]): Promise<Metrics> {
    let totalScore = 0
    let totalTokens = 0
    let totalLatency = 0

    for (const ex of dataset) {
      const prompt = candidate.text.replace('{input}', ex.input)
      const exec = await this.executor(prompt, ex.input)
      const score = this.scorer(exec.output, ex.output)
      totalScore += score
      totalTokens += exec.tokens
      totalLatency += exec.latencyMs
    }

    const n = dataset.length
    return {
      accuracy: totalScore / n,
      costUSD: (totalTokens / 1000) * this.costPerKToken,
      latencyMs: totalLatency / n,
    }
  }

  /**
   * 파레토 1차 프런트 식별 (지배되지 않는 후보).
   */
  private assignParetoRank(results: CandidateResult[]): void {
    for (const r of results) {
      let dominatedBy = 0
      for (const other of results) {
        if (other === r) continue
        if (this.dominates(other.metrics, r.metrics)) {
          dominatedBy += 1
        }
      }
      r.paretoRank = dominatedBy === 0 ? 1 : 2
    }
  }

  /**
   * a가 b를 지배하는가 (정확도 ≥, 비용 ≤, 레이턴시 ≤, 최소 하나는 strict).
   */
  private dominates(a: Metrics, b: Metrics): boolean {
    const ge = a.accuracy >= b.accuracy && a.costUSD <= b.costUSD && a.latencyMs <= b.latencyMs
    const strict = a.accuracy > b.accuracy || a.costUSD < b.costUSD || a.latencyMs < b.latencyMs
    return ge && strict
  }

  private compositeScore(m: Metrics, wAcc: number, wCost: number, wLat: number): number {
    // cost와 latency는 작을수록 좋음 → 역수 정규화
    const accNorm = m.accuracy
    const costNorm = 1 / (1 + m.costUSD)
    const latNorm = 1 / (1 + m.latencyMs / 1000)
    return wAcc * accNorm + wCost * costNorm + wLat * latNorm
  }

  private percentDelta(base: number, next: number): number {
    if (base === 0) return next === 0 ? 0 : 100
    return ((next - base) / base) * 100
  }
}

export function createPromptOptimizer(options: ConstructorParameters<typeof PromptOptimizer>[0]): PromptOptimizer {
  return new PromptOptimizer(options)
}
