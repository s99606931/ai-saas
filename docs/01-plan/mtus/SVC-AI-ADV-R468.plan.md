# SVC-AI-ADV-R468 Plan — AI기반 자동 디지털 전환 평가 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 디지털 전환 수준을 자동 평가하여 전략 수립 지원 |
| WHO | 디지털 전환 담당자, 정보화 기획팀 |
| RISK | 평가 항목 간 가중치 산정 오류 방지 필요 |
| SUCCESS | SC-R468-1: 기관 등록 / SC-R468-2: 전환 점수 계산 / SC-R468-3: C/S 등급 차단 |
| SCOPE | digital-transformation-assessor-v2.ts 구현 |

## 요구사항
- FR-R468.1: 기관 등록 (orgId, name, type)
- FR-R468.2: 평가 항목 기록 (category: process/technology/culture/data, score 0-100)
- FR-R468.3: 전환 점수 = 4개 category 평균
- FR-R468.4: 전환 단계 (>=75: leading, >=50: progressing, >=25: initiating, else lagging)
- FR-R468.5: N2SF N-05 C/S 등급 차단

## 추적성
FR-R468.* ↔ `digital-transformation-assessor-v2.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
