# SVC-AI-ADV-R85 — AI API 지연 예측기 (Latency Predictor)

> v1.0.0 | 2026-04-12 | PM Lead (5차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | SLA 99.9% 선제 대응 | 예측 오차 ≤ 20% |
| 기술 | 이동 평균 + 분위수 기반 P50/P95/P99 예측 | 예측 p95 < 2ms |
| 보안 | 감사 로그 | CSAP D-06 |
| 품질 | 온라인 학습(관측 업데이트) | 결정적 |

## Context Anchor
- **WHY**: API 요청 부하에 따라 P99 레이턴시가 급격히 증가하면 SLA 위반. 사전 예측으로 프리워밍/큐 전환 가능해야 한다.
- **WHO**: API Gateway, AutoScaler, SRE
- **RISK**: 과소 예측 → SLA 위반, 과대 예측 → 자원 낭비
- **SUCCESS**: P99 예측 오차 ≤ 20%, 예측 지연 ≤ 2ms
- **SCOPE**: IN — 관측 기록/분위수 추정/예측/경고 / OUT — 실제 스케일링

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R85.1 | observe(ms) 관측 기록 (ring buffer) | latency-predictor.ts |
| FR-R85.2 | P50/P95/P99 분위수 계산 | 동일 |
| FR-R85.3 | predictWithLoad(qps) 부하 보정 예측 | 동일 |
| FR-R85.4 | SLA 위반 임박 경고 (임계값) | 동일 |
| FR-R85.5 | getAuditLog + OBSERVE/PREDICT/WARN | 동일 |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| R85.1~4 | latency-predictor.ts | latency-predictor.test.ts | - |
| R85.5 | 동일 | 동일 | D-06 |
