# SVC-AI-ADV-R666 Design — AI기반 네트워크 트래픽 분류 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R666.1~5 구현 |
| 보안 | N2SF N-05 차단, IP SHA-256, CSAP D-06 감사 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/network-traffic-classifier-ai-v3.ts |

## 설계 결정
- `NetworkTrafficClassifierAIV3` 클래스
- `classify(flow, dataGrade?)` → category + maskedSrc/Dst
- 기본 분류:
  - port ∈ {22, 3389, 9100} → MANAGEMENT
  - bytesPerSec > 1e8 또는 알려지지 않은 포트 + 비정상 비율 → ANOMALY
  - 그 외 → BUSINESS
- audit action: CLASSIFY_FLOW

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
