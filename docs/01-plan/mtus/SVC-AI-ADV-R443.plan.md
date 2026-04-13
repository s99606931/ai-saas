# SVC-AI-ADV-R443 Plan — AI기반 공공 서비스 접점 자동 분석

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 서비스 접점별 민원인 경험 데이터를 AI로 분석하여 서비스 품질 향상 |
| WHO | 서비스 기획자, 품질 관리자 |
| RISK | 민원인 PII(citizenId) 마스킹 필수 |
| SUCCESS | SC-R443-1: 접점 등록 / SC-R443-2: 만족도 평균 계산 / SC-R443-3: C/S 등급 차단 |
| SCOPE | public-service-touchpoint-analyzer.ts 구현 |

## 요구사항
- FR-R443.1: 서비스 접점 등록 (touchpointId, name, channel)
- FR-R443.2: 상호작용 기록 (citizenId, satisfactionScore 1-5, waitTimeMs)
- FR-R443.3: PII 마스킹 (citizenId → SHA-256 16자 hex)
- FR-R443.4: 접점별 평균 만족도 및 대기시간 계산
- FR-R443.5: N2SF N-05 C/S 등급 차단

## 추적성
FR-R443.* ↔ `public-service-touchpoint-analyzer.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
