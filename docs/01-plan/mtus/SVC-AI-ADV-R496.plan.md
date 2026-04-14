# SVC-AI-ADV-R496 Plan — operations-manual-generator-v2.ts

## 요구사항
FR-R496.1: 매뉴얼 섹션 등록 (sectionId, title, content, category)
FR-R496.2: 섹션 내용 업데이트 (sectionId, newContent, dataGrade?)
FR-R496.3: 매뉴얼 목차 조회 (getTableOfContents)
FR-R496.4: 카테고리별 섹션 조회 (getSectionsByCategory)
FR-R496.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R496.1: N2SF N-05 C/S 등급 차단
SC-R496.2: CSAP D-06 감사 로그 append-only
SC-R496.3: CSAP D-09 PII SHA-256 마스킹
