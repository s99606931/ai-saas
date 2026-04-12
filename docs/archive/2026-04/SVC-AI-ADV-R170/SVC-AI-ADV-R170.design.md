# SVC-AI-ADV-R170 — 서버리스 비용 최적화기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export interface FunctionExecution {
  functionId: string; timestamp: number
  durationMs: number; memoryMb: number; coldStart: boolean }

export interface CostBreakdown {
  functionId: string; totalInvocations: number; totalDurationMs: number
  avgMemoryMb: number; estimatedCost: number; currency: string }

export interface OptimizationSuggestion {
  functionId: string; type: 'MEMORY_OVERALLOC' | 'COLDSTART_HIGH' | 'DURATION_HIGH'
  currentValue: number; recommendedValue: number; estimatedSavingPct: number
  description: string }

export interface SavingsReport {
  functionId: string; currentCost: number; optimizedCost: number
  savingPct: number; suggestions: OptimizationSuggestion[] }

class ServerlessCostOptimizer {
  recordExecution(exec: FunctionExecution): void
  calculateCost(functionId: string): CostBreakdown
  suggestOptimizations(functionId: string): OptimizationSuggestion[]
  generateSavingsReport(functionId: string): SavingsReport | null
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘

- 비용 계산: (totalDurationMs / 100) × (avgMemoryMb / 128) × 0.0000002 (원/GB-s 단위)
- 메모리 과할당: avgMemoryMb > 512 → MEMORY_OVERALLOC, recommended = ceil(avgMemoryMb * 0.7)
- 콜드스타트 비율 > 30% → COLDSTART_HIGH
- avgDurationMs > 3000ms → DURATION_HIGH
- 절감율: (currentCost - optimizedCost) / currentCost
