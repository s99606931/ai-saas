# SVC-AI-ADV-R261 — 보안 이벤트 자동 대응 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
SecurityEventAutoResponder
├── registerRule(id, eventType, threshold, action, cooldownMs)
├── recordEvent(type, severity, sourceIp, grade)
├── processEvent(eventId): ResponseDecision
│   └── 매칭 규칙 찾기 → 임계값 체크 → 쿨다운 체크 → 액션 결정
├── getResponseHistory(eventType?): ResponseRecord[]
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **임계값**: 시간 윈도우 내 동일 유형 이벤트 수 ≥ threshold → 대응
- **쿨다운**: 마지막 대응 후 cooldownMs 내 중복 대응 방지
- **액션**: block/isolate/alert/notify 중 규칙에 정의된 액션 반환

## CSAP D-06 준수

- 모든 보안 이벤트 + 대응 결정 감사 로그
- N2SF C/S 등급 차단
