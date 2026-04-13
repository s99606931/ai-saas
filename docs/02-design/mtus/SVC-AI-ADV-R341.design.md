# SVC-AI-ADV-R341 Design: AI기반 공공기관 조직 학습 분석

## 핵심 알고리즘

### 학습 효율 계산
- completionRate = completedCount / totalCount * 100
- avgScore = sum(scores) / completedCount
- efficiency = completionRate * avgScore / 100

### PII 마스킹
- memberId SHA-256 → 16자

## 인터페이스 설계

```typescript
class OrganizationalLearningAnalyzerAI {
  registerMember(id, department): void
  recordLearning(memberId, courseId, score, completed, grade?): void
  getMemberStats(memberId): LearningStats
  getDepartmentStats(department): DepartmentStats
  getAuditLog(): AuditEntry[]
}

interface LearningStats {
  maskedMemberId: string
  completionRate: number
  avgScore: number
  efficiency: number
}
```
