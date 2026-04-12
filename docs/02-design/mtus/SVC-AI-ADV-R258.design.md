# SVC-AI-ADV-R258 — 디지털 트윈 데이터 동기화 엔진 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
DigitalTwinSyncEngine
├── registerEntity(entity, grade)
├── registerAnomalyRule(rule)
├── updateState(entityId, newState): UpdateResult
├── getState(entityId): TwinState
├── getHistory(entityId): TwinVersion[]
├── computeDelta(prev, next): Delta
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **Delta 계산**: 두 객체의 키별 값 비교 → `{ added, removed, changed }` 객체 반환
- **이상 감지**: 규칙별 field 값이 [min, max] 범위 밖이면 severity에 따라 LOW/MED/HIGH 반환
- **버전 관리**: 업데이트 시마다 version += 1, 이전 상태 보존

## CSAP 준수

- D-06: 등록·업데이트 감사 로그 (entityId 마스킹)
- D-12: field 값 숫자 검증, 규칙 min <= max
- N2SF: C/S 차단
