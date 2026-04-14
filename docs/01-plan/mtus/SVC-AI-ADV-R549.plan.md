# SVC-AI-ADV-R549 Plan — public-data-open-index-v2.ts
## 요구사항
FR-R549.1: 데이터셋 등록 (datasetId, name, agency, totalRecords)
FR-R549.2: 공개 정보 기록 (datasetId, openRecords, formats[], dataGrade?)
FR-R549.3: 개방 지수 조회 (getOpenIndex) — openRecords/totalRecords*100
FR-R549.4: 저개방 데이터셋 조회 (getLowOpenDatasets) — openIndex < 50
FR-R549.5: 감사 로그 조회 (getAuditLog)
## 성공 기준
SC-R549.1: N2SF N-05 C/S 등급 차단 / SC-R549.2: CSAP D-06 감사 로그
