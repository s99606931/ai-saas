# SVC-AI-ADV-R554 Plan — deployment-rollback-optimizer-v2.ts
## 요구사항
FR-R554.1: 배포 등록 (deployId, serviceId, version, deployedAt)
FR-R554.2: 배포 상태 업데이트 (deployId, status, errorRate, dataGrade?)
FR-R554.3: 롤백 필요 여부 조회 (needsRollback) — errorRate > 5%
FR-R554.4: 롤백 대상 배포 조회 (getRollbackCandidates)
FR-R554.5: 감사 로그 조회 (getAuditLog)
## 성공 기준
SC-R554.1: N2SF N-05 C/S 등급 차단 / SC-R554.2: CSAP D-06 감사 로그
