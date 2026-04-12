/**
 * Policy Impact Analyzer AI — SVC-AI-ADV-R131 (트랙 B 2차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R130-R137-trackB/SVC-AI-ADV-R131.design.md
 * Plan SC: FR-R131.1 ~ FR-R131.5
 *
 * 정책 시행 전/후 데이터 분석 → 효과 자동 측정 (차분분석, Cohen's d).
 * 순수 통계 계산 — 외부 API 없음.
 *
 * NOTE: 기존 policy-impact-analyzer.ts(MTU-N284)와 별도 파일 — 공공정책 효과 특화.
 */

// Design Ref: §2 — 타입 정의

export type Phase = 'before' | 'after'

export interface PolicyRecord {
  policyId: string
  name: string
  implementedDate: string
  description?: string
}

export interface MetricEntry {
  policyId: string
  phase: Phase
  value: number
  date: string
}

export interface EffectResult {
  policyId: string
  policyName: string
  meanBefore: number
  meanAfter: number
  difference: number
  percentChange: number
  cohensD: number
  significance: 'SIGNIFICANT' | 'MARGINAL' | 'NONE'
  samplesBefore: number
  samplesAfter: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  policyId: string
}

export class PolicyImpactAnalyzerAi {
  private readonly policies = new Map<string, PolicyRecord>()
  private readonly metrics = new Map<string, MetricEntry[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R131.1
  registerPolicy(policy: PolicyRecord): void {
    this.policies.set(policy.policyId, { ...policy })
  }

  // Plan SC: FR-R131.2
  addMetric(policyId: string, phase: Phase, value: number, date: string): void {
    if (!this.policies.has(policyId)) {
      throw new Error(`Unknown policy: ${policyId}`)
    }
    const list = this.metrics.get(policyId) ?? []
    list.push({ policyId, phase, value, date })
    this.metrics.set(policyId, list)
  }

  // Plan SC: FR-R131.3 — Design Ref: §3.1~§3.3
  analyzeEffect(policyId: string): EffectResult {
    const policy = this.policies.get(policyId)
    if (!policy) throw new Error(`Unknown policy: ${policyId}`)

    const entries = this.metrics.get(policyId) ?? []
    const before = entries.filter((e) => e.phase === 'before').map((e) => e.value)
    const after = entries.filter((e) => e.phase === 'after').map((e) => e.value)

    const meanBefore = this.mean(before)
    const meanAfter = this.mean(after)
    const difference = meanAfter - meanBefore
    const percentChange = meanBefore !== 0 ? (difference / Math.abs(meanBefore)) * 100 : 0

    const pooledStd = this.pooledStd(before, after)
    const cohensD = pooledStd > 0 ? difference / pooledStd : 0

    let significance: EffectResult['significance'] = 'NONE'
    if (Math.abs(cohensD) >= 0.8) significance = 'SIGNIFICANT'
    else if (Math.abs(cohensD) >= 0.2) significance = 'MARGINAL'

    this.appendAudit('effect.analyze', policyId)

    return {
      policyId,
      policyName: policy.name,
      meanBefore,
      meanAfter,
      difference,
      percentChange,
      cohensD,
      significance,
      samplesBefore: before.length,
      samplesAfter: after.length,
    }
  }

  // Plan SC: FR-R131.4
  generateReport(policyId: string): string {
    const result = this.analyzeEffect(policyId)
    const policy = this.policies.get(policyId)!
    const lines: string[] = []
    lines.push('# 정책 효과 분석 보고서')
    lines.push('')
    lines.push(`**정책명**: ${result.policyName}`)
    lines.push(`**시행일**: ${policy.implementedDate}`)
    lines.push('')
    lines.push('## 분석 결과')
    lines.push('')
    lines.push(`| 지표 | 값 |`)
    lines.push(`|------|----|`)
    lines.push(`| 시행 전 평균 | ${result.meanBefore.toFixed(2)} (n=${result.samplesBefore}) |`)
    lines.push(`| 시행 후 평균 | ${result.meanAfter.toFixed(2)} (n=${result.samplesAfter}) |`)
    lines.push(`| 차이 | ${result.difference.toFixed(2)} (${result.percentChange.toFixed(1)}%) |`)
    lines.push(`| Cohen's d | ${result.cohensD.toFixed(3)} |`)
    lines.push(`| 유의성 | ${result.significance} |`)
    lines.push('')
    lines.push(`생성일: ${new Date().toISOString().slice(0, 10)}`)
    return lines.join('\n')
  }

  // Plan SC: FR-R131.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  private std(values: number[]): number {
    if (values.length < 2) return 0
    const m = this.mean(values)
    return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1))
  }

  private pooledStd(a: number[], b: number[]): number {
    const na = a.length
    const nb = b.length
    if (na + nb < 4) return 0
    const sa = this.std(a)
    const sb = this.std(b)
    return Math.sqrt(((na - 1) * sa ** 2 + (nb - 1) * sb ** 2) / (na + nb - 2))
  }

  private appendAudit(action: string, policyId: string): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      policyId,
    })
  }
}
