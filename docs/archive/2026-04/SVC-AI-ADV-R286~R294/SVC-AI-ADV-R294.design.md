# SVC-AI-ADV-R294 Design: AI기반 보안 패치 우선순위화

## 핵심 알고리즘

### 우선순위 점수 계산
- impactScore = impactedSystems * 10 (최대 100)
- difficultyPenalty = difficulty ('easy'=1, 'medium'=2, 'hard'=3)
- priorityScore = (cvssScore * 10 + impactScore) / difficultyPenalty
- 점수 내림차순 정렬

### 패치 상태
- status: 'pending' | 'applied'
- 적용 완료 시 appliedAt 기록

## 인터페이스 설계

```typescript
class SecurityPatchPrioritizerAI {
  registerPatch(id, cveId, cvssScore, impactedSystems, difficulty): void
  calculatePriority(patchId): PatchPriority
  getRoadmap(): PatchPriority[]
  applyPatch(patchId, grade?): void
  getAuditLog(): AuditEntry[]
}

interface PatchPriority {
  patchId: string
  cveId: string
  cvssScore: number
  priorityScore: number
  status: 'pending' | 'applied'
}
```
