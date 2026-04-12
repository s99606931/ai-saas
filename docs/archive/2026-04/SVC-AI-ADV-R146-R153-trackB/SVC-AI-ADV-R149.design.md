# SVC-AI-ADV-R149 — 멀티테넌트 비용 배분 AI (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R149.plan.md

## 1. 아키텍처

```
registerTenant → recordUsage → calculateCost → generateInvoice
      ↓
MultitenantCostAllocator
  ├─ 자원 유형별 단가 적용 (cpu/memory/storage/api)
  ├─ 기간 필터 집계
  ├─ 최소 요금 보장
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export type ResourceType = 'cpu' | 'memory' | 'storage' | 'api_call'
export interface Tenant { tenantId: string; name: string; tier: 'basic'|'standard'|'premium' }
export interface UsageRecord { tenantId: string; resource: ResourceType
  amount: number; timestamp: number }
export interface Invoice {
  tenantId: string; period: string; lineItems: LineItem[]
  subtotal: number; minimumFee: number; total: number; generatedAt: string }
export interface LineItem { resource: ResourceType; amount: number; unitPrice: number; cost: number }
```

## 3. 알고리즘

### §3.1 단가 (기본): cpu=0.05/core-h, memory=0.01/GB-h, storage=0.001/GB-day, api=0.0001/call
### §3.2 tier 할인: basic=0%, standard=10%, premium=20%
### §3.3 최소 요금: basic=10,000원, standard=50,000원, premium=200,000원

## 4. Design Anchor
- CSAP D-06: 청구 감사 로그
