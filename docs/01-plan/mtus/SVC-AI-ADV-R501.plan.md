# SVC-AI-ADV-R501 Plan — microservice-performance-profiler-v2.ts

## 요구사항
FR-R501.1: 마이크로서비스 등록 (serviceId, name, version)
FR-R501.2: 성능 메트릭 기록 (serviceId, cpuPercent, memPercent, requestsPerSec, dataGrade?)
FR-R501.3: 성능 점수 조회 (getPerformanceScore) — max(0, 100 - cpu*0.4 - mem*0.3 - max(0,requestsPerSec-100)*0.1)
FR-R501.4: 저성능 서비스 조회 (getLowPerformanceServices) — score < 60
FR-R501.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R501.1: N2SF N-05 C/S 등급 차단
SC-R501.2: CSAP D-06 감사 로그 append-only
SC-R501.3: CSAP D-09 PII SHA-256 마스킹
