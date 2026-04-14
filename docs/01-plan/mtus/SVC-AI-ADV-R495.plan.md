# SVC-AI-ADV-R495 Plan — auto-data-classifier-v3.ts

## 요구사항
FR-R495.1: 데이터 항목 등록 (itemId, name, keywords[])
FR-R495.2: 데이터 분류 (itemId, dataGrade?) — keywords 기반 자동 분류
FR-R495.3: 분류 결과 조회 (getClassification)
FR-R495.4: 등급별 항목 목록 조회 (getItemsByGrade)
FR-R495.5: 감사 로그 조회 (getAuditLog)

## 분류 규칙
keywords에 'secret','password','주민번호','개인정보' 포함 → C등급
keywords에 'internal','confidential','기밀' 포함 → S등급
그 외 → O등급

## 성공 기준
SC-R495.1: N2SF N-05 C/S 등급 차단
SC-R495.2: CSAP D-06 감사 로그 append-only
