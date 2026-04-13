# SVC-AI-ADV-R384 Design: AI기반 멀티에이전트 협업 최적화

## 핵심 알고리즘

### 부하율 계산
- `utilizationRate = completedTasks / maxCapacity * 100`
- 에이전트별 completedTasks 카운팅

### 협업 효율 점수
- `collaborationEfficiency = totalCompleted / totalCapacity * 100`
- 모든 에이전트의 완료 작업 합 / 전체 최대 용량 합

## 클래스 설계

```typescript
class MultiAgentCollaborationOptimizer {
  registerAgent(id, name, maxCapacity): void
  assignTask(agentId, taskId, processingMs, grade): void
  getAgentUtilization(agentId): UtilizationResult
  getCollaborationEfficiency(): number
  getAuditLog(): AuditEntry[]
}
```

## N2SF / CSAP 적용
- C/S 등급: assignTask 차단
- 감사 로그: agent.register, task.assign
