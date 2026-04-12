# Plan: MTU-N171 k6 성능 회귀 테스트 자동화

> 버전: 1.0 | 작성일: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 모든 배포에서 성능 회귀 자동 탐지, SLA 위반 사전 방지 |
| 기술 | k6 Operator + Testkube + CI/CD 통합 |
| 보안 | 테스트 데이터 N2SF O등급, 결과 내부 저장 |
| 운영 | PR별 경량 스모크, 배포후 전체 부하, 야간 소크 테스트 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-PERF.1 | k6 테스트 스크립트 프레임워크 (공통 유틸) | HIGH |
| FR-PERF.2 | API 엔드포인트별 성능 기준선(Baseline) 정의 | HIGH |
| FR-PERF.3 | PR별 스모크 테스트 (10초, 5VU) | HIGH |
| FR-PERF.4 | 배포 후 부하 테스트 (5분, 50VU) | HIGH |
| FR-PERF.5 | 야간 소크 테스트 (30분, 20VU) | MED |
| FR-PERF.6 | 성능 회귀 자동 탐지 (기준선 대비 P95 20%+ 증가) | HIGH |
| FR-PERF.7 | Grafana k6 결과 대시보드 | MED |
| FR-PERF.8 | CI/CD 파이프라인 통합 (실패 시 배포 차단) | HIGH |
