# SVC-AI-ADV-R452 Plan — 공공 데이터 이상치 감지기

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공공 데이터셋 품질 관리: 이상치 자동 탐지·정정 권고 |
| WHO | 데이터 관리자, 공공데이터포털 |
| WHAT | 수치 시계열 → 이상치 목록 |
| HOW | IQR(사분위수 범위) 방법 |

## Context Anchor
- WHY: 정책 결정에 쓰이는 공공 데이터의 신뢰성 확보
- WHO: 공공 데이터 품질 담당자
- RISK: 오탐 → 다중 기준 병행
- SUCCESS: IQR 범위 외 100% 탐지
- SCOPE: `public-data-outlier-detector.ts`

## 요구사항
- FR-452.1: Input = { datasetId, values: number[] }
- FR-452.2: Q1/Q3/IQR 계산, 하한=Q1-1.5*IQR, 상한=Q3+1.5*IQR
- FR-452.3: 범위 밖 값 → Outlier { index, value, bound: 'LOW'|'HIGH' }
- FR-452.4: 빈 배열 → 빈 결과
- FR-452.5: 권고 = 값이 하한 미만이면 `Q1 값`, 상한 초과면 `Q3 값`
- FR-452.6: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-452.* ↔ `public-data-outlier-detector.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
