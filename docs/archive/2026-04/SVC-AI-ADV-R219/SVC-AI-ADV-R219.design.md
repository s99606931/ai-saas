# SVC-AI-ADV-R219 — 자동 장애 탐지 및 격리 Design

> 작성일: 2026-04-12 | 버전: 1.0.0

## 컴포넌트 설계

```
FaultDetectorIsolatorAI
├── registerService(id, name, failureThreshold, cooldownMs)
├── recordHealthEvent(serviceId, healthy, grade)
├── getServiceStatus(serviceId): ServiceStatus
│   ├── state: 'healthy' | 'isolated' | 'recovering'
│   └── consecutiveFailures: number
├── checkRecovery(serviceId): RecoveryResult
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **서킷브레이커**: 연속 실패 ≥ failureThreshold → isolated
- **복구 조건**: 마지막 격리 후 cooldownMs 경과 + 최근 이벤트 성공
- **상태 전환**: healthy → isolated → recovering → healthy

## CSAP D-12 준수

- 격리/복구 모든 상태 변화 감사 로그
- N2SF C/S 등급 차단
