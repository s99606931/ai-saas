# Plan: MTU-N174 15라운드 통합 테스트

> 버전: 1.0 | 작성일: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 15라운드 5개 MTU 통합 검증 |
| 기술 | DORA + Keycloak + k6 + GitOps + MLflow 상호 연동 |
| 보안 | 전체 컴포넌트 CSAP 준수 확인 |
| 운영 | 통합 배포 순서 및 의존성 검증 |

## 통합 대상

| MTU | 컴포넌트 | 상태 |
|-----|---------|------|
| N169 | DORA 4 Metrics | PASS - 95% |
| N170 | Keycloak SSO/OIDC | PASS - 95% |
| N171 | k6 성능 회귀 테스트 | PASS - 95% |
| N172 | GitOps 환경 승격 게이트 | PASS - 95% |
| N173 | MLflow 모델 레지스트리 | PASS - 95% |

## 통합 검증 항목

| ID | 항목 | 기준 |
|----|------|------|
| INT-1 | DORA 대시보드 → Grafana 통합 | 메트릭 수집 정상 |
| INT-2 | Keycloak OIDC → API Gateway 연동 | 토큰 검증 정상 |
| INT-3 | k6 테스트 → GitOps 승격 게이트 | 스모크 통과 시 자동 승격 |
| INT-4 | MLflow → KServe 모델 배포 | 모델 서빙 정상 |
| INT-5 | 전체 CSAP D-08/D-09/D-06 준수 | 100% |
