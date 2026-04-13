# SVC-AI-ADV-R345 Design: AI기반 DevSecOps 파이프라인 자동화

## 핵심 알고리즘

### 파이프라인 점수
- pipelineScore = passCount / totalSteps * 100
- fail 단계가 있으면 pipelineStatus = 'failed'

### 단계 종류
- sast, dast, dependency-check, secret-scan, container-scan

## 인터페이스 설계

```typescript
class DevSecOpsPipelineAI {
  registerPipeline(id, name, steps: string[]): void
  recordStepResult(pipelineId, stepName, passed, findings, grade?): void
  getPipelineScore(pipelineId): PipelineResult
  getFailedSteps(pipelineId): StepResult[]
  getAuditLog(): AuditEntry[]
}

interface PipelineResult {
  pipelineId: string
  pipelineScore: number
  pipelineStatus: 'passed' | 'failed'
  passCount: number
  totalSteps: number
}
```
