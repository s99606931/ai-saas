# SVC-AI-ADV-R115 — AI Governance Dashboard Backend Design

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R115.plan.md

## 아키텍처

```
recordMetric(category, name, value, grade, tags)
  → inMemory rollup (minute → hour → day)
  → query API (timeseries / snapshot)
  → RBAC filter → response
  → threshold check → event
```

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }
export type MetricCategory = 'safety' | 'accuracy' | 'utilization' | 'cost'
export type Resolution = 'minute' | 'hour' | 'day'
export type Role = 'admin' | 'auditor' | 'viewer'

export interface MetricInput {
  category: MetricCategory
  name: string
  value: number
  grade: DataGrade
  tags?: Record<string, string>
}

export interface MetricPoint {
  timestamp: number
  value: number
  count: number  // 집계된 샘플 수
}

export interface Snapshot {
  category: MetricCategory
  metrics: Record<string, { latest: number; avg: number; count: number }>
}

export interface Alert {
  metricName: string
  value: number
  threshold: number
  timestamp: number
}

export interface DashboardOptions {
  thresholds?: Record<string, number>
  role?: Role  // 운영 중 변경 금지
}
```

## 저장 구조

- `Map<category, Map<name, MetricPoint[]>>` 시계열
- 30분마다 rollup 호출 가능(테스트에서 수동 호출)

## RBAC

- viewer → safety/accuracy 카테고리만
- auditor → viewer + cost
- admin → 전체

## 보안

- C/S 등급 value는 마스킹(-1) 처리하여 저장 안함
- O 등급만 저장
- audit log

## Session Guide

1. 타입 + Map 초기화
2. recordMetric + rollup
3. query API (timeseries + snapshot)
4. RBAC filter
5. alert check + audit + 8 test
