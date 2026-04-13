# SVC-AI-ADV-R424 Plan — Environmental Impact Assessor

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공공사업 환경영향(온실가스/소음/수질) 자동 평가로 심사 기간 단축 |
| WHO | 환경부, 지자체 환경과 |
| WHAT | 사업 데이터 → 영향 점수 + 등급(A~E) + 권고 |
| HOW | 영역별 정규화 + 가중 합산 |

## Context Anchor
- WHY: 소규모 사업 신속 처리
- WHO: 환경 담당자, 시민
- RISK: 기준 미달 사업 반려 필요
- SUCCESS: 등급 정확도 ≥ 90%
- SCOPE: `environmental-impact-assessor.ts`

## 요구사항
- FR-424.1: ghgScore = clip(emissionsTon × 2, 0, 100)
- FR-424.2: noiseScore = clip((dB - 40) × 2, 0, 100)
- FR-424.3: waterScore = clip(wastewaterTon × 5, 0, 100)
- FR-424.4: totalImpact = ghg×0.5 + noise×0.2 + water×0.3
- FR-424.5: grade A<20, B<40, C<60, D<80, E≥80
- FR-424.6: N2SF C/S 차단 + 감사 로그

## 추적성
FR-424.* ↔ `environmental-impact-assessor.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
