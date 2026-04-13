# SVC-AI-ADV-R347 Design: AI기반 공공기관 인사 데이터 분석

## 핵심 알고리즘

### PII 마스킹
- employeeId SHA-256 → 16자 해시

### 부서 통계
- avgPerformance = sum(scores) / count
- headcount = 해당 부서 직원 수

## 인터페이스 설계

```typescript
class HrDataAnalyzerAI {
  registerEmployee(id, department, grade?): void
  recordPerformance(employeeId, score, period, grade?): void
  getDepartmentStats(department): DepartmentHrStats
  getTopPerformers(topN): PerformerEntry[]
  getAuditLog(): AuditEntry[]
}

interface DepartmentHrStats {
  department: string
  headcount: number
  avgPerformance: number
}

interface PerformerEntry {
  maskedEmployeeId: string
  department: string
  avgScore: number
}
```
