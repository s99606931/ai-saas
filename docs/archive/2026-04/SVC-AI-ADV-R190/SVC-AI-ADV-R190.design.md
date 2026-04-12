# SVC-AI-ADV-R190 — 부서 성과 대시보드 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export type PerfGrade = 'S' | 'A' | 'B' | 'C' | 'D'
export interface Kpi { kpiId: string; department: string; name: string; targetValue: number; unit: string }
export interface KpiRecord { kpiId: string; period: string; actualValue: number }
export interface DeptPerformance { department: string; avgAchievementRate: number; grade: PerfGrade; kpiCount: number }
class DepartmentPerformanceDashboard {
  registerKpi(kpi: Kpi): void
  recordActual(record: KpiRecord): void
  getDeptPerformance(department: string): DeptPerformance
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘
- achievementRate = actualValue / targetValue (clamp 0~1.5)
- 등급: avgRate ≥ 1.2→S, ≥ 0.9→A, ≥ 0.7→B, ≥ 0.5→C, else→D
