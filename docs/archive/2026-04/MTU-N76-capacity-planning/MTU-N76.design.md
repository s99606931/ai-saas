# MTU-N76: 자동 용량 계획 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10

---

## 1. ResourceQuota 등급 체계

| 등급 | CPU Requests | Memory Requests | Pods | PVCs | 대상 |
|------|-------------|----------------|------|------|------|
| Small | 2 cores | 4Gi | 20 | 5 | 소규모 테넌트 |
| Medium | 4 cores | 8Gi | 40 | 10 | 중규모 테넌트 |
| Large | 8 cores | 16Gi | 80 | 20 | 대규모 테넌트 |

## 2. LimitRange 기본값

| 유형 | CPU Request | CPU Limit | Mem Request | Mem Limit |
|------|-----------|---------|-----------|---------|
| Default | 50m | 200m | 64Mi | 256Mi |
| Min | 10m | 10m | 16Mi | 16Mi |
| Max | 2 cores | 4 cores | 4Gi | 8Gi |

## 3. 용량 예측 알림

| 알림 | 조건 | 심각도 |
|------|------|--------|
| QuotaUsageHigh | >80% 할당 사용 | warning |
| QuotaUsageCritical | >90% 할당 사용 | critical |
| ClusterCapacityLow | 전체 가용 <20% | critical |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
