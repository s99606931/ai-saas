# SVC-AI-ADV-R193 Plan: AI기반 스트리밍 이상 감지

| 항목 | 내용 |
|------|------|
| MTU ID | SVC-AI-ADV-R193 |
| 기능명 | AI기반 스트리밍 이상 감지 |
| 구현 파일 | streaming-anomaly-detector.ts |
| 작성일 | 2026-04-12 |

## 성공 기준
- SC01: Z-score > sigma 시 SPIKE/DROP/STOP 탐지
- SC02: 베이스라인(이전 이벤트) 기반 통계 — 현재 이벤트 제외
- SC03: std=0 베이스라인 시 임의 변화 감지
