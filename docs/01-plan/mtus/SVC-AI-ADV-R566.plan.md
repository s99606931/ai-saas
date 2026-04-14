# SVC-AI-ADV-R566 Plan — AI기반 서비스 API 사용량 예측 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | API 사용량 증가 추이를 예측하여 선제적 용량 확보 |
| WHO | API 게이트웨이 운영자, 용량 계획 담당자 |
| RISK | 과소 예측으로 인한 서비스 장애 방지 |
| SUCCESS | SC-R566-1: 사용 이력 수집 / SC-R566-2: 증가율 예측 / SC-R566-3: 용량 권고 |
| SCOPE | api-usage-forecaster-v3.ts 구현 |

## 요구사항
- FR-R566.1: 입력 (apiId, dailyUsage: number[], forecastDays: number) — dailyUsage 최소 3개
- FR-R566.2: 평균 일일 증가율 = (마지막값 - 첫번째값) / (dailyUsage.length - 1) / 첫번째값
- FR-R566.3: 예측 사용량 (forecastDays일 후) = 마지막값 × (1 + 평균증가율)^forecastDays
- FR-R566.4: 용량 권고 = ceil(예측사용량 × 1.3) (30% 여유)
- FR-R566.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R566.* ↔ `api-usage-forecaster-v3.ts` ↔ 테스트 ↔ CSAP D-06
