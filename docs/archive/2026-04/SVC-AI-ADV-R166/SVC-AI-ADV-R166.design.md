# SVC-AI-ADV-R166 — 서비스 품질 자동 평가기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface ServiceMetric {
  serviceId: string; timestamp: number
  responseTimeMs: number; errorRate: number; availabilityPct: number }

export interface SlaThreshold {
  serviceId: string; maxResponseTimeMs: number
  maxErrorRate: number; minAvailabilityPct: number }

export interface QualityReport {
  serviceId: string; grade: QualityGrade; score: number
  avgResponseTimeMs: number; avgErrorRate: number; avgAvailabilityPct: number
  slaViolations: string[]; evaluatedAt: string }

class ServiceQualityEvaluator {
  registerSla(threshold: SlaThreshold): void
  recordMetric(metric: ServiceMetric): void
  evaluate(serviceId: string): QualityReport
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘

- 점수 계산 (100점 만점): 응답시간 40점 + 오류율 30점 + 가용성 30점
  - 응답시간: avg ≤ threshold → 40점, 비율로 감점
  - 오류율: avg ≤ threshold → 30점, 초과 시 0점
  - 가용성: avg ≥ threshold → 30점, 비율로 감점
- 등급: score ≥ 90→A, ≥ 75→B, ≥ 60→C, ≥ 40→D, else→F
