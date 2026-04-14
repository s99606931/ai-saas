# SVC-AI-ADV-R533 Plan — public-data-hub-optimizer-ai.ts
## 요구사항
FR-R533.1: 데이터 소스 등록 (sourceId, name, category, dataVolumeGB)
FR-R533.2: 접근 패턴 기록 (sourceId, accessCount, avgLatencyMs, dataGrade?)
FR-R533.3: 최적화 점수 조회 (getOptimizationScore) — accessCount*10 / (avgLatencyMs+1)
FR-R533.4: 최적화 우선순위 목록 조회 (getOptimizationPriority) — score 내림차순
FR-R533.5: 감사 로그 조회 (getAuditLog)
## 성공 기준
SC-R533.1: N2SF N-05 C/S 등급 차단
SC-R533.2: CSAP D-06 감사 로그 append-only
