# SVC-AI-ADV-R260 Design — 재난 대응 코디네이터

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: PM Lead

## Design Anchor

- Plan Ref: SVC-AI-ADV-R260.plan.md
- Implementation: `platform/services/ai-service/src/lib/disaster-response-coordinator.ts`
- Tests: `__tests__/disaster-response-coordinator.test.ts`

## 아키텍처 (Pragmatic Balance)

```
DisasterEvent 등록 → classifySeverity() → allocateShelter() → planResources() → issueAlert()
```

## 핵심 타입

```typescript
type DisasterType = 'FLOOD'|'EARTHQUAKE'|'FIRE'|'TYPHOON'|'HEATWAVE'|'OTHER'
type Severity = 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'
type AlertLevel = 'ADVISORY'|'WATCH'|'WARNING'|'EMERGENCY'

interface DisasterEvent { eventId, type, locationCode, affectedCount, occurredAt }
interface Shelter { shelterId, locationCode, capacity, currentOccupancy }
interface ShelterAllocation { shelterId, assignedCount }
interface ResourcePlan { medicalKits, foodPacks, waterLiters, reliefKits }
interface CitizenAlert { alertLevel, message, targetLocationCode }
```

## 심각도 규칙

| affected | severity | alertLevel | medical/식량/물 |
|----------|----------|-----------|-----------------|
| <100 | LOW | ADVISORY | 10/50/100 |
| <1000 | MEDIUM | WATCH | 50/500/1000 |
| <10000 | HIGH | WARNING | 200/3000/10000 |
| ≥10000 | CRITICAL | EMERGENCY | 1000/15000/50000 |

## 대피소 배분 규칙

1. 동일 locationCode 대피소 우선, 없으면 전체 대피소 대상
2. 여유 용량 `capacity - currentOccupancy` 큰 순 정렬
3. greedy 배분: affectedCount 소진될 때까지 순차 할당
4. 부족 시 shortage 반환

## 보안

- C/S 등급 호출 차단
- `citizen-***-xx` 형식 마스킹
- getAuditLog() append-only
