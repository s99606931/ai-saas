# SVC-AI-ADV-R665 Design — AI기반 공공조달 사기 탐지 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R665.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, bidder SHA-256, CSAP D-06 감사 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/public-procurement-fraud-detector-v3.ts |

## 설계 결정
- `PublicProcurementFraudDetectorV3` 클래스
- `analyze(bids[], dataGrade?)` → 의심 입찰자 목록 + suspicionScore
- 점수 가중치: 가격 편차(0.4) + 동일IP 공유(0.3) + 반복 수주(0.3)
- 임계값: ≥0.7 HIGH, 0.4~0.7 MID, <0.4 LOW
- audit action: ANALYZE_BIDS

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
