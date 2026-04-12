# MTU Design — SVC-AI-ADV-R149 Model Fallback Chain

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R149.plan.md

## 아키텍처: Ordered Chain + Cooldown Circuit Breaker

```
execute(req, runner):
  for model in sorted(chain, priority asc):
    if !isHealthy(model, now): continue
    try:
      result = await runner(model, req)
      return { modelId, result, attempts }
    catch e:
      attempts.push({ modelId, error })
      markUnhealthy(model, defaultCooldown)
      continue
  throw chain_exhausted
```

## 타입

```ts
export interface ChainModel {
  modelId: string
  priority: number // 낮을수록 우선
  unhealthyUntil?: number
}

export interface ExecuteResult<T> {
  modelId: string
  result: T
  attempts: Array<{ modelId: string; error: string }>
}

export type Runner<T> = (modelId: string, req: unknown) => Promise<T>
```

## API

```ts
class ModelFallbackChain {
  register(modelId: string, priority: number): void
  markUnhealthy(modelId: string, cooldownMs: number): void
  isHealthy(modelId: string, now?: number): boolean
  execute<T>(req: { grade?: DataGrade }, runner: Runner<T>): Promise<ExecuteResult<T>>
  getAuditLog(): AuditEntry[]
}
```

## 예외

- 빈 체인: `no_models`
- 전체 unhealthy/실패: `chain_exhausted`
- 중복 register: `duplicate_model`
- C/S등급: `grade_blocked`
