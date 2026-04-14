# SVC-AI-ADV-R482 Plan — AI기반 공공 데이터 연계 자동화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 여러 공공 데이터 소스의 스키마 불일치를 자동 탐지하고 연계 매핑 권고 |
| WHO | 데이터 통합 담당자, 공공 API 운영팀 |
| RISK | 스키마 불일치로 인한 데이터 연계 오류 방지 필요 |
| SUCCESS | SC-R482-1: 소스 등록 / SC-R482-2: 스키마 비교 / SC-R482-3: 매핑 권고 |
| SCOPE | public-data-linkage-automator-v3.ts 구현 |

## 요구사항
- FR-R482.1: 데이터 소스 입력 (sourceId, fields: string[], grade: 'O'|'C'|'S')
- FR-R482.2: C/S 등급 소스 처리 차단 (throw BLOCKED)
- FR-R482.3: 두 소스 간 필드 교집합/차집합 분석
- FR-R482.4: 매핑 가능 필드 = 교집합, 누락 필드 = 차집합
- FR-R482.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R482.* ↔ `public-data-linkage-automator-v3.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
