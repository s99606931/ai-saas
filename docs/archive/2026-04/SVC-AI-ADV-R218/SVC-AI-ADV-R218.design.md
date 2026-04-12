# SVC-AI-ADV-R218 — 서비스 메시 보안 정책 Design

> 작성일: 2026-04-12 | 버전: 1.0.0

## 컴포넌트 설계

```
ServiceMeshSecurityAI
├── registerService(id, name, securityLevel)
├── addPolicy(fromId, toId, action, priority)
├── inspectTraffic(event): InspectionResult
│   └── 정책 우선순위 순 평가 → 최초 매칭 적용
├── analyzeAnomalies(windowMs): AnomalyReport
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **정책 평가**: priority 내림차순 정렬, 최초 매칭 정책 적용
- **이상 탐지**: 시간 윈도우 내 차단 비율 계산
- **보안 등급**: HIGH/MEDIUM/LOW 서비스 간 통신 제한

## CSAP D-08 준수

- 모든 트래픽 이벤트 감사 로그
- N2SF C/S 등급 차단
