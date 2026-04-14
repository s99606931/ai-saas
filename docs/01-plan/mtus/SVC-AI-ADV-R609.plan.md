# SVC-AI-ADV-R609 Plan — AI기반 공공 서비스 비교 분석 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 유사 공공 서비스를 비교 분석하여 벤치마킹 및 개선 방향 도출 |
| WHO | 서비스 기획자, 정책 담당자 |
| RISK | 불공정 비교로 인한 잘못된 정책 결정 방지 |
| SUCCESS | SC-R609-1: 서비스 수집 / SC-R609-2: 비교 분석 / SC-R609-3: 순위 결정 |
| SCOPE | public-service-comparison-analyzer-v2.ts 구현 |

## 요구사항
- FR-R609.1: 입력 (analysisId, services: {serviceId, usageCount, satisfactionScore: 0~5, costEfficiency: 0~100, accessibilityScore: 0~100}[])
- FR-R609.2: 각 서비스 종합 점수 = min(usageCount/10000,1)*100*0.3 + satisfactionScore/5*100*0.3 + costEfficiency*0.2 + accessibilityScore*0.2
- FR-R609.3: 등급 (>=80: EXCELLENT, >=60: GOOD, >=40: AVERAGE, else POOR)
- FR-R609.4: 1위/꼴찌 서비스 식별 + 평균 점수
- FR-R609.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R609.* ↔ `public-service-comparison-analyzer-v2.ts` ↔ 테스트 ↔ CSAP D-06
