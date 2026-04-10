# MTU-N125: 알림 피로도 분석 -- 완료 보고서

> 완료일: 2026-04-10
> matchRate: 100%
> 테스트: 25/25 통과

## Executive Summary

| 관점 | 달성 |
|------|------|
| 비즈니스 | 알림 피로도 정량 측정 체계 구축, 온콜 부담 가시화 |
| 기술 | Prometheus Recording Rule 6개 + Alert 2개 + 분석 스크립트 |
| 보안 | CSAP D-06 감사 추적 완비, 알림 효과성 측정 |
| 운영 | 주간/월간 피로도 보고서 자동 생성, 최적화 권장 자동 도출 |

## 산출물

| 산출물 | 경로 | FR |
|--------|------|----|
| 피로도 분석 스크립트 | `scripts/analyze-alert-fatigue.sh` | FR-N125.1, FR-N125.3, FR-N125.4 |
| Recording Rule | `infra/monitoring/alert-fatigue-rules.yaml` | FR-N125.2 |
| E2E 테스트 | `scripts/test-alert-fatigue.sh` | FR-N125.5 |

## 기능 요구사항 달성

| ID | 요구사항 | 상태 |
|----|---------|------|
| FR-N125.1 | 알림 피로도 지표 계산 (SNR, 반복률, 일간 밀도) | 완료 |
| FR-N125.2 | Recording Rule 6개 (active_total, snr_ratio 등) | 완료 |
| FR-N125.3 | 주간/월간 피로도 보고서 자동 생성 | 완료 |
| FR-N125.4 | 최적화 권장 사항 자동 도출 (4개 분야) | 완료 |
| FR-N125.5 | E2E 테스트 25개 전체 통과 | 완료 |

## 피로도 등급 체계

| 등급 | 일간 알림 | SNR | 반복률 |
|------|---------|-----|--------|
| LOW | < 15건 | > 70% | < 15% |
| MEDIUM | 15~30건 | 50~70% | 15~25% |
| HIGH | > 30건 | < 50% | > 25% |
