# SVC-AI-ADV-R512 Plan — AI기반 공공기관 데이터 품질 자동 개선 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 데이터의 형식 오류, 결측값, 중복을 자동 탐지하고 개선 권고 |
| WHO | 데이터 관리 담당자, 공공 데이터 운영팀 |
| RISK | 불량 데이터로 인한 행정 처리 오류 방지 |
| SUCCESS | SC-R512-1: 데이터 검증 / SC-R512-2: 오류 분류 / SC-R512-3: 개선 권고 |
| SCOPE | public-data-quality-improver-v3.ts 구현 |

## 요구사항
- FR-R512.1: 레코드 입력 (recordId, fields: Record<string,string>, grade: 'O'|'C'|'S')
- FR-R512.2: C/S 등급 차단 (throw BLOCKED)
- FR-R512.3: 오류 유형 탐지 (MISSING_FIELD: 빈 값, FORMAT_ERROR: 날짜 형식 2026.xx.xx→오류, DUPLICATE: 동일 recordId 재입력)
- FR-R512.4: 품질 점수 = (정상 필드수/전체 필드수) * 100
- FR-R512.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R512.* ↔ `public-data-quality-improver-v3.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
