# SVC-AI-ADV-R538 Plan — AI기반 공공기관 서비스 혁신 지표 분석

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 디지털 전환 수준을 정량화하여 혁신 투자 우선순위 결정 지원 |
| WHO | 정보화 기획 담당자, 감사원 |
| RISK | 지표 조작·오해석으로 인한 잘못된 예산 배정 방지 |
| SUCCESS | SC-R538-1: 지표 수집 / SC-R538-2: 혁신 점수 산출 / SC-R538-3: 등급 분류 |
| SCOPE | service-innovation-index-ai.ts 구현 |

## 요구사항
- FR-R538.1: 입력 (agencyId, digitalServiceRate, processAutomationRate, dataOpenRate, citizenSatisfaction) — 각 0~100
- FR-R538.2: 혁신 지수 = digitalServiceRate*0.3 + processAutomationRate*0.3 + dataOpenRate*0.2 + citizenSatisfaction*0.2
- FR-R538.3: 등급 분류 (>=80: INNOVATING, >=60: ADVANCING, >=40: DEVELOPING, else LAGGING)
- FR-R538.4: 최저 지표 식별 (개선 권고 대상)
- FR-R538.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R538.* ↔ `service-innovation-index-ai.ts` ↔ 테스트 ↔ CSAP D-06
