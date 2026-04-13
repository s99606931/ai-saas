# SVC-AI-ADV-R469 Plan — AI기반 공공기관 데이터 생명주기 관리 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 데이터 생명주기(생성→보관→폐기)를 자동 관리하여 규정 준수 |
| WHO | 데이터 관리자, 기록물 담당자 |
| RISK | 보관 기간 초과 데이터 누락 방지 필요 |
| SUCCESS | SC-R469-1: 데이터 등록 / SC-R469-2: 폐기 대상 탐지 / SC-R469-3: C/S 등급 차단 |
| SCOPE | public-data-lifecycle-manager-v2.ts 구현 |

## 요구사항
- FR-R469.1: 데이터 등록 (dataId, name, category, retentionYears)
- FR-R469.2: 데이터 생성 일자 기록
- FR-R469.3: 폐기 대상 조회 (createdAt + retentionYears * 365일 < 현재)
- FR-R469.4: 데이터 폐기 처리 및 감사 로그 기록
- FR-R469.5: N2SF N-05 C/S 등급 차단

## 추적성
FR-R469.* ↔ `public-data-lifecycle-manager-v2.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
