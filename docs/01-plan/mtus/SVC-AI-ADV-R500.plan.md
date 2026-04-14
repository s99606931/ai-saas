# SVC-AI-ADV-R500 Plan — security-patch-prioritizer-v2.ts

## 요구사항
FR-R500.1: 패치 등록 (patchId, title, cvssScore, affectedSystems[])
FR-R500.2: 패치 상태 업데이트 (patchId, status, dataGrade?)
FR-R500.3: 우선순위 점수 조회 (getPriorityScore) — cvssScore*10 + affectedSystems.length*5
FR-R500.4: 우선순위 정렬 목록 조회 (getPrioritizedPatches) — score 내림차순
FR-R500.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R500.1: N2SF N-05 C/S 등급 차단
SC-R500.2: CSAP D-06 감사 로그 append-only
