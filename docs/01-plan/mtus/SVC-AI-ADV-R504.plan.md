# SVC-AI-ADV-R504 Plan — service-dependency-health-v2.ts

## 요구사항
FR-R504.1: 서비스 등록 (serviceId, name, version)
FR-R504.2: 의존성 건강 기록 (serviceId, dependencyId, latencyMs, errorRate, dataGrade?)
FR-R504.3: 건강 점수 조회 (getHealthScore) — max(0, 100 - latency/10 - errorRate*2)
FR-R504.4: 비건강 의존성 조회 (getUnhealthyDependencies) — score < 60
FR-R504.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R504.1: N2SF N-05 C/S 등급 차단
SC-R504.2: CSAP D-06 감사 로그 append-only
